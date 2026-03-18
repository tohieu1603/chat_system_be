import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { TOOL_DEFINITIONS } from './tool-definitions';

export interface StreamChunk {
  content: string | null;
  toolCalls?: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall[];
  isDone: boolean;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>('AI_API_KEY') ?? '';
    const baseURL = config.get<string>('AI_API_URL') ?? 'https://ark.ap-southeast.bytepluses.com/api/coding/v3';
    this.model = config.get<string>('AI_MODEL') ?? 'kimi-k2.5';

    this.client = new OpenAI({ apiKey, baseURL });
    this.logger.log(`AiService initialized: model=${this.model}`);
  }

  getTools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return TOOL_DEFINITIONS;
  }

  async *chat(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    includeTools = true,
  ): AsyncGenerator<StreamChunk> {
    this.logger.log(`chat: messages=${messages.length}, tools=${includeTools}`);

    const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
      model: this.model,
      messages,
      stream: true,
      temperature: 0.6,
      max_tokens: 8192,
    };

    if (includeTools) {
      params.tools = this.getTools();
      params.tool_choice = 'auto';
    }

    const stream = await this.client.chat.completions.create(params);

    // Accumulate tool calls across chunks
    const toolCallsMap: Map<number, OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall & { arguments_acc: string }> = new Map();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      const finishReason = chunk.choices[0]?.finish_reason;

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCallsMap.has(idx)) {
            toolCallsMap.set(idx, { ...tc, arguments_acc: tc.function?.arguments ?? '' });
          } else {
            const existing = toolCallsMap.get(idx)!;
            existing.arguments_acc += tc.function?.arguments ?? '';
          }
        }
        // Don't yield content for tool call chunks
        continue;
      }

      const content = delta?.content ?? null;

      if (finishReason === 'stop' || finishReason === 'tool_calls') {
        if (toolCallsMap.size > 0) {
          // Build finalized tool calls
          const finalizedToolCalls = Array.from(toolCallsMap.values()).map((tc) => ({
            ...tc,
            function: {
              name: tc.function?.name ?? '',
              arguments: tc.arguments_acc,
            },
          }));
          yield { content: null, toolCalls: finalizedToolCalls, isDone: true };
        } else {
          yield { content, isDone: true };
        }
        return;
      }

      if (content !== null) {
        yield { content, isDone: false };
      }
    }

    yield { content: null, isDone: true };
  }

  async continueWithToolResults(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  ): Promise<string> {
    this.logger.log('continueWithToolResults: getting final AI response after tool calls');

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.6,
      max_tokens: 8192,
    });

    return response.choices[0]?.message?.content ?? '';
  }
}
