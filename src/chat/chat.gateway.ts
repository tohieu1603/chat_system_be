import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IncomingMessage } from 'http';
import * as WebSocket from 'ws';
import { ChatService } from './chat.service';
import { AiService } from '../ai/ai.service';
import { PromptService } from '../ai/prompt.service';
import { ToolHandlerService } from '../ai/tool-handler.service';
import { FallbackExtractorService } from '../ai/fallback-extractor.service';
import { ProjectsService } from '../projects/projects.service';
import { SenderType, ProjectStatus } from '../common/enums';
import { Project } from '../entities/project.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';

interface ClientMeta {
  userId: string;
  conversationId?: string;
}

interface WsMessage {
  event: string;
  data: Record<string, any>;
}

@WebSocketGateway({ path: '/ws' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: WebSocket.Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly clients = new Map<WebSocket, ClientMeta>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly chatService: ChatService,
    private readonly aiService: AiService,
    private readonly promptService: PromptService,
    private readonly toolHandler: ToolHandlerService,
    private readonly fallbackExtractor: FallbackExtractorService,
    private readonly projectsService: ProjectsService,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  handleConnection(client: WebSocket, req: IncomingMessage): void {
    const token = this.extractToken(req);

    if (!token) {
      this.logger.warn('WS connection rejected: no token');
      client.send(JSON.stringify({ event: 'error', data: { code: 401, message: 'Unauthorized' } }));
      client.close();
      return;
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET') ?? 'default-secret';
      const payload = this.jwtService.verify(token, { secret });
      this.clients.set(client, { userId: payload.sub ?? payload.id });
      this.logger.log(`WS connected: userId=${payload.sub ?? payload.id}`);

      client.on('message', (raw: WebSocket.RawData) => {
        void this.handleMessage(client, raw.toString());
      });
    } catch {
      this.logger.warn('WS connection rejected: invalid token');
      client.send(JSON.stringify({ event: 'error', data: { code: 401, message: 'Invalid token' } }));
      client.close();
    }
  }

  handleDisconnect(client: WebSocket): void {
    const meta = this.clients.get(client);
    this.logger.log(`WS disconnected: userId=${meta?.userId}`);
    this.clients.delete(client);
  }

  private async handleMessage(client: WebSocket, raw: string): Promise<void> {
    let msg: WsMessage;
    try {
      msg = JSON.parse(raw) as WsMessage;
    } catch {
      this.send(client, 'error', { code: 400, message: 'Invalid JSON' });
      return;
    }

    const { event, data } = msg;

    try {
      switch (event) {
        case 'join_conversation':
          await this.onJoinConversation(client, data);
          break;
        case 'send_message':
          await this.onSendMessage(client, data);
          break;
        case 'leave_conversation':
          this.onLeaveConversation(client);
          break;
        default:
          this.logger.warn(`Unknown WS event: ${event}`);
      }
    } catch (err) {
      this.logger.error(`Error handling event ${event}: ${(err as Error).message}`);
      this.send(client, 'error', { code: 500, message: (err as Error).message });
    }
  }

  private async onJoinConversation(client: WebSocket, data: Record<string, any>): Promise<void> {
    const conversationId = data['conversation_id'] as string;
    if (!conversationId) {
      this.send(client, 'error', { code: 400, message: 'conversation_id required' });
      return;
    }

    const meta = this.clients.get(client);
    if (!meta) return;

    meta.conversationId = conversationId;
    this.logger.log(`User ${meta.userId} joined conversation ${conversationId}`);
    this.send(client, 'joined', { conversation_id: conversationId });
  }

  private async onSendMessage(client: WebSocket, data: Record<string, any>): Promise<void> {
    const meta = this.clients.get(client);
    if (!meta) return;

    const conversationId = (data['conversation_id'] as string) ?? meta.conversationId;
    const content = data['content'] as string;

    if (!conversationId || !content?.trim()) {
      this.send(client, 'error', { code: 400, message: 'conversation_id and content required' });
      return;
    }

    // Save user message
    const userMsg = await this.chatService.saveMessage(
      conversationId,
      SenderType.USER,
      content,
      meta.userId,
    );
    this.broadcastToConversation(conversationId, 'new_message', {
      id: userMsg.id,
      conversation_id: conversationId,
      sender_type: SenderType.USER,
      content: userMsg.content,
      created_at: userMsg.created_at,
    });

    // Load conversation + project
    const conversation = await this.chatService.findById(conversationId, ['project']);
    if (!conversation) {
      this.send(client, 'error', { code: 404, message: 'Conversation not found' });
      return;
    }

    const project = await this.projectRepo.findOne({ where: { id: conversation.project_id } });
    if (!project) {
      this.send(client, 'error', { code: 404, message: 'Project not found' });
      return;
    }

    // Signal typing
    this.broadcastToConversation(conversationId, 'typing', {
      conversation_id: conversationId,
      sender_type: 'AI',
      is_typing: true,
    });

    try {
      // Build messages
      const history = await this.chatService.getRecentMessages(conversationId, 50);
      const historyWithoutLast = history.filter((m) => m.id !== userMsg.id);
      const systemPrompt = this.promptService.buildSystemPrompt(
        project.project_name,
        project.collection_progress,
      );
      const messages = this.promptService.buildMessages(systemPrompt, historyWithoutLast, content);

      // Stream AI response
      let fullContent = '';
      let finalToolCalls: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall[] | undefined;

      for await (const chunk of this.aiService.chat(messages)) {
        if (chunk.toolCalls && chunk.toolCalls.length > 0) {
          finalToolCalls = chunk.toolCalls;
          break;
        }

        if (chunk.content) {
          fullContent += chunk.content;
          this.broadcastToConversation(conversationId, 'ai_stream_chunk', {
            conversation_id: conversationId,
            chunk: chunk.content,
            is_done: false,
          });
        }

        if (chunk.isDone && !finalToolCalls) {
          break;
        }
      }

      // Handle tool calls if any
      if (finalToolCalls && finalToolCalls.length > 0) {
        await this.processToolCalls(
          client,
          finalToolCalls,
          messages,
          conversationId,
          project.id,
          userMsg.id,
          fullContent,
        );
        return;
      }

      // Fallback: AI didn't call tools — extract data from user message
      const extracted = await this.fallbackExtractor.extractAndSave(
        content,
        project.id,
        conversationId,
        userMsg.id,
      );

      // Re-fetch project for updated progress if fallback extracted data
      let latestProgress = project.collection_progress;
      if (extracted) {
        const updated = await this.projectRepo.findOne({ where: { id: project.id } });
        latestProgress = updated?.collection_progress ?? latestProgress;
        this.broadcastToConversation(conversationId, 'collection_updated', {
          conversation_id: conversationId,
          project_id: project.id,
          collection_progress: latestProgress,
        });

        // Auto-complete if user says "đủ rồi" / "chuyển giai đoạn"
        const doneKeywords = ['đủ rồi', 'chuyển giai đoạn', 'hoàn tất', 'xong rồi', 'done'];
        if (doneKeywords.some((kw) => content.toLowerCase().includes(kw)) && updated?.status === 'COLLECTING') {
          await this.projectRepo.update(project.id, { status: ProjectStatus.COLLECTED });
          try {
            await this.projectsService.generateDocument(project.id);
            this.logger.log(`Auto doc-gen (fallback) for project ${project.id}`);
          } catch (err) {
            this.logger.error(`Auto doc-gen failed: ${(err as Error).message}`);
          }
          this.broadcastToConversation(conversationId, 'collection_complete', {
            project_id: project.id,
            conversation_id: conversationId,
          });
        }
      }

      // Save AI message
      const aiMsg = await this.chatService.saveMessage(
        conversationId,
        SenderType.AI,
        fullContent,
      );

      this.broadcastToConversation(conversationId, 'ai_stream_done', {
        conversation_id: conversationId,
        full_message: fullContent,
        message_id: aiMsg.id,
        collection_progress: latestProgress,
      });
    } finally {
      // Always stop typing indicator — even on error
      this.broadcastToConversation(conversationId, 'typing', {
        conversation_id: conversationId,
        sender_type: 'AI',
        is_typing: false,
      });
    }
  }

  private async processToolCalls(
    client: WebSocket,
    toolCalls: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall[],
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    conversationId: string,
    projectId: string,
    messageId: string,
    partialContent: string,
  ): Promise<void> {
    const toolResults = await this.toolHandler.handleToolCalls(
      toolCalls as any,
      projectId,
      conversationId,
      messageId,
    );

    // Broadcast collection update with latest progress
    const updatedProject = await this.projectRepo.findOne({ where: { id: projectId } });
    this.broadcastToConversation(conversationId, 'collection_updated', {
      conversation_id: conversationId,
      project_id: projectId,
      collection_progress: updatedProject?.collection_progress ?? {},
    });

    // Check if mark_collection_complete was called → auto-generate document
    const isComplete = toolCalls.some((tc) => tc.function?.name === 'mark_collection_complete');
    if (isComplete) {
      try {
        await this.projectsService.generateDocument(projectId);
        this.logger.log(`Document auto-generated for project ${projectId}`);
      } catch (err) {
        this.logger.error(`Auto doc-gen failed: ${(err as Error).message}`);
      }
      this.broadcastToConversation(conversationId, 'collection_complete', {
        project_id: projectId,
        conversation_id: conversationId,
      });
    }

    // Continue conversation with tool results
    const assistantMsg: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
      role: 'assistant',
      content: partialContent || null,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id ?? `tc_${Date.now()}`,
        type: 'function' as const,
        function: {
          name: tc.function?.name ?? '',
          arguments: (tc as any).arguments_acc ?? tc.function?.arguments ?? '{}',
        },
      })),
    };

    const continuedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...messages,
      assistantMsg,
      ...toolResults,
    ];

    // Stream the continuation response (instead of waiting for full response)
    let finalContent = '';
    for await (const chunk of this.aiService.chat(continuedMessages, false)) {
      if (chunk.content) {
        finalContent += chunk.content;
        this.broadcastToConversation(conversationId, 'ai_stream_chunk', {
          conversation_id: conversationId,
          chunk: chunk.content,
          is_done: false,
        });
      }
      if (chunk.isDone) break;
    }

    const aiMsg = await this.chatService.saveMessage(conversationId, SenderType.AI, finalContent);

    // Re-fetch project for updated progress
    const project = await this.projectRepo.findOne({ where: { id: projectId } });

    this.broadcastToConversation(conversationId, 'ai_stream_done', {
      conversation_id: conversationId,
      full_message: finalContent,
      message_id: aiMsg.id,
      collection_progress: project?.collection_progress ?? {},
    });
    // typing:false is handled by onSendMessage's finally block
  }

  private onLeaveConversation(client: WebSocket): void {
    const meta = this.clients.get(client);
    if (meta) {
      this.logger.log(`User ${meta.userId} left conversation ${meta.conversationId}`);
      meta.conversationId = undefined;
    }
  }

  private send(client: WebSocket, event: string, data: Record<string, any>): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event, data }));
    }
  }

  private broadcastToConversation(conversationId: string, event: string, data: Record<string, any>): void {
    for (const [client, meta] of this.clients.entries()) {
      if (meta.conversationId === conversationId) {
        this.send(client, event, data);
      }
    }
  }

  private extractToken(req: IncomingMessage): string | null {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    const tokenFromQuery = url.searchParams.get('token');
    if (tokenFromQuery) return tokenFromQuery;

    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return null;
  }
}
