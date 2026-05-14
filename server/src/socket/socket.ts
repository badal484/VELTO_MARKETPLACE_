import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { IMessage } from '@shared/types';
import { SocketEvent } from '@shared/constants/socketEvents';

let ioInstance: Server;

export const getIO = (): Server => {
  if (!ioInstance) {
    throw new Error('Socket.io not initialized!');
  }
  return ioInstance;
};

export const initSocket = (httpServer: HttpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: '*',
    }
  });

  ioInstance.on('connection', (socket: Socket) => {
    
    socket.on('join_user', (userId: string) => {
      socket.join(userId);
      console.log(`[SOCKET] User ${userId} joined their private room`);
    });

    socket.on(SocketEvent.JOIN_CONVERSATION, (conversationId: string) => {
      const room = conversationId.toString();
      socket.join(room);
      console.log(`[SOCKET] Socket ${socket.id} joined conversation room: ${room}`);
    });

    socket.on(SocketEvent.SEND_MESSAGE, async (data: { conversationId: string; text: string; receiverId: string; message: IMessage }) => {
      const room = data.conversationId.toString();
      const receiverRoom = data.receiverId.toString();
      
      console.log(`[SOCKET] Relay message to room ${room} and receiver ${receiverRoom}`);
      // 1. Emit to the conversation room (for those currently in the chat)
      ioInstance.to(room).emit(SocketEvent.RECEIVE_MESSAGE, data.message);
      
      // 2. Emit to the receiver's private room (for notifications/unread counts)
      ioInstance.to(receiverRoom).emit(SocketEvent.NEW_MESSAGE_NOTIFICATION, {
        conversationId: room,
        message: data.message
      });

      // 3. Push Notification via FCM
      try {
        const { FCMService } = require('../services/fcmService');
        const { User } = require('../models/User');
        const sender = await User.findById(data.message.sender).select('name');
        
        await FCMService.sendToUser(
          data.receiverId,
          sender ? `New message from ${sender.name}` : 'New Message',
          data.text,
          { 
            type: 'CHAT', 
            conversationId: data.conversationId,
            senderId: data.message.sender.toString()
          }
        );
      } catch (err) {
        console.error('FCM Message Push Error:', err);
      }
    });

    socket.on(SocketEvent.TYPING, (data: { conversationId: string; userId: string }) => {
      socket.to(data.conversationId).emit(SocketEvent.TYPING, data);
    });

    // Real-Time Rider Location Tracking
    socket.on('update_rider_location', (data: { orderId: string; lat: number; lng: number; buyerId: string }) => {
      // Broadcast to the buyer's private room
      ioInstance.to(data.buyerId).emit('rider_location_updated', {
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
