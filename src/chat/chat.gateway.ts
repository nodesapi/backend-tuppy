import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Track online status of SUPPORT and ADMIN users
  // Set of connected admin/support user IDs
  private onlinePlatformStaff = new Set<string>();

  // Map of socket id to user info
  private connectedClients = new Map<
    string,
    { role: string; userId: string; email?: string }
  >();

  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (token) {
        // Authenticated user (could be admin, support, tenant)
        const payload = this.jwtService.verify(token);
        this.connectedClients.set(client.id, {
          role: payload.role,
          userId: payload.sub,
          email: payload.email,
        });

        // If they are platform staff, track them and broadcast online status
        if (payload.role === 'ADMIN' || payload.role === 'SUPPORT') {
          this.onlinePlatformStaff.add(payload.sub);
          this.broadcastPlatformStatus();
          client.join('platform_staff');
        } else if (payload.role === 'TENANT') {
          client.join(`tenant_${payload.sub}`);
        }
      } else {
        // Guest user on landing page
        const guestToken = client.handshake.query?.guestToken as string;
        if (guestToken) {
          client.join(`guest_${guestToken}`);
        }
      }

      // Immediately send current platform status to the newly connected client
      client.emit('platformStatus', {
        isOnline: this.onlinePlatformStaff.size > 0,
      });
    } catch (e) {
      // Allow unauthenticated connection for guests, but they won't have roles
      const guestToken = client.handshake.query?.guestToken as string;
      if (guestToken) {
        client.join(`guest_${guestToken}`);
      }
      client.emit('platformStatus', {
        isOnline: this.onlinePlatformStaff.size > 0,
      });
    }
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      if (clientInfo.role === 'ADMIN' || clientInfo.role === 'SUPPORT') {
        // Check if this user has other active sockets before removing from online set
        let hasOtherConnections = false;
        for (const [id, info] of this.connectedClients.entries()) {
          if (id !== client.id && info.userId === clientInfo.userId) {
            hasOtherConnections = true;
            break;
          }
        }

        if (!hasOtherConnections) {
          this.onlinePlatformStaff.delete(clientInfo.userId);
          this.broadcastPlatformStatus();
        }
      }
      this.connectedClients.delete(client.id);
    }
  }

  private broadcastPlatformStatus() {
    const isOnline = this.onlinePlatformStaff.size > 0;
    this.server.emit('platformStatus', { isOnline });
  }

  // Allow clients to ask for status
  @SubscribeMessage('getPlatformStatus')
  handleGetPlatformStatus(client: Socket) {
    client.emit('platformStatus', {
      isOnline: this.onlinePlatformStaff.size > 0,
    });
  }

  // Utility to send new message to a specific guest
  notifyGuest(guestToken: string, message: any) {
    this.server.to(`guest_${guestToken}`).emit('newMessage', message);
  }

  // Utility to send new message to platform staff
  notifyPlatformStaff(message: any) {
    this.server.to('platform_staff').emit('newMessage', message);
  }
}
