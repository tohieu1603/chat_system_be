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
import { Notification } from '../entities/notification.entity';

@WebSocketGateway({ path: '/ws/notifications' })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: WebSocket.Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  /** Map from userId -> WebSocket client */
  private readonly clients = new Map<string, WebSocket>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: WebSocket, req: IncomingMessage): void {
    const token = this.extractToken(req);

    if (!token) {
      this.logger.warn('Notifications WS rejected: no token');
      client.send(JSON.stringify({ event: 'error', data: { code: 401, message: 'Unauthorized' } }));
      client.close();
      return;
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET') ?? (() => { throw new Error('JWT_SECRET is required'); })();
      const payload = this.jwtService.verify(token, { secret }) as Record<string, any>;
      const userId = String(payload['sub'] ?? payload['id'] ?? '');

      if (!userId) {
        throw new Error('No user ID in token payload');
      }

      this.clients.set(userId, client);
      this.logger.log(`Notifications WS connected: userId=${userId}`);

      client.on('close', () => {
        this.clients.delete(userId);
        this.logger.log(`Notifications WS closed: userId=${userId}`);
      });
    } catch {
      this.logger.warn('Notifications WS rejected: invalid token');
      client.send(JSON.stringify({ event: 'error', data: { code: 401, message: 'Invalid token' } }));
      client.close();
    }
  }

  handleDisconnect(client: WebSocket): void {
    // Clean up by finding userId key for this client
    for (const [userId, ws] of this.clients.entries()) {
      if (ws === client) {
        this.clients.delete(userId);
        this.logger.log(`Notifications WS disconnected: userId=${userId}`);
        break;
      }
    }
  }

  /** Push a notification to a specific user if they are connected */
  sendToUser(userId: string, notification: Notification): void {
    const client = this.clients.get(userId);
    if (client?.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event: 'notification', data: notification }));
      this.logger.log(`sendToUser: userId=${userId}, notificationId=${notification.id}`);
    } else {
      this.logger.debug(`sendToUser: userId=${userId} not connected, skipping`);
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
