import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { IMessage } from '@shared/types';
import { SocketEvent } from '@shared/constants/socketEvents';

export let io: Server;

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
    }
  });

  io.on('connection', (socket: Socket) => {
    
    socket.on('join_user', (userId: string) => {
      socket.join(userId);
      console.log(`User ${userId} joined their private room`);
    });
    socket.on(SocketEvent.JOIN_CONVERSATION, (conversationId: string) => {
      socket.join(conversationId);
    });

    socket.on(SocketEvent.SEND_MESSAGE, (data: { conversationId: string; text: string; receiverId: string; message: IMessage }) => {
      // 1. Emit to the conversation room (for those currently in the chat)
      io.to(data.conversationId).emit(SocketEvent.RECEIVE_MESSAGE, data.message);
      
      // 2. Emit to the receiver's private room (for notifications/unread counts)
      io.to(data.receiverId).emit(SocketEvent.NEW_MESSAGE_NOTIFICATION, {
        conversationId: data.conversationId,
        message: data.message
      });
    });

    socket.on(SocketEvent.TYPING, (data: { conversationId: string; userId: string }) => {
      socket.to(data.conversationId).emit(SocketEvent.TYPING, data);
    });

    // Real-Time Rider Location Tracking
    socket.on('update_rider_location', (data: { orderId: string; lat: number; lng: number; buyerId: string }) => {
      // Broadcast to the buyer's private room
      io.to(data.buyerId).emit('rider_location_updated', {
        orderId: data.orderId,
        lat: data.lat,
        lng: data.lng,
        timestamp: new Date()
      });
    });

    // Proactive Global State Syncing for nearby job discovery
    socket.on('sync_rider_state', async (data: { lat: number; lng: number }) => {
      try {
        // Find the user associated with this socket
        // Note: In a production environment, we'd use the userId passed during connection
        // For now, we'll try to identify the user from the rooms they've joined
        const rooms = Array.from(socket.rooms);
        const userId = rooms.find(r => r !== socket.id); 

        if (userId && data.lat && data.lng) {
          const { User } = require('../models/User');
          await User.findByIdAndUpdate(userId, {
            location: {
              type: 'Point',
              coordinates: [data.lng, data.lat]
            }
          });
        }
      } catch (err) {
        console.error('State Sync Fail:', err);
      }
    });

    socket.on('disconnect', () => {
    });
  });
};
