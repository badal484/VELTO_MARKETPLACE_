import { Request, Response } from 'express';
import { Conversation } from '../models/Conversation';
import { User } from '../models/User';
import { Message } from '../models/Message';
import { Role } from '@shared/types';
import { handleError, AppError } from '../utils/errors';
import mongoose from 'mongoose';

export const startConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { receiverId, productId, orderId } = req.body;

    const sender = await User.findById(req.user?._id);
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // --- COMMUNICATION FIREWALL ---
    const sRole = sender.role;
    const rRole = receiver.role;

    const allowedPairs: [Role, Role][] = [
      [Role.ADMIN, Role.BUYER],
      [Role.ADMIN, Role.SELLER],
      [Role.ADMIN, Role.SHOP_OWNER],
      [Role.ADMIN, Role.RIDER],
      [Role.BUYER, Role.RIDER],
      [Role.BUYER, Role.SELLER],
      [Role.BUYER, Role.SHOP_OWNER],
      [Role.RIDER, Role.SELLER],
      [Role.RIDER, Role.SHOP_OWNER],
    ];

    const allowed =
      sRole === Role.ADMIN ||
      rRole === Role.ADMIN ||
      allowedPairs.some(
        ([a, b]) => (sRole === a && rRole === b) || (sRole === b && rRole === a)
      );

    if (!allowed) {
      res.status(403).json({
        success: false,
        message: `Direct communication between ${sRole} and ${rRole} is not permitted.`,
      });
      return;
    }

    // Find existing conversation for this pair + context
    let conversation;
    if (orderId) {
      conversation = await Conversation.findOne({
        participants: { $all: [req.user?._id, receiverId] },
        order: orderId,
      });
    } else if (productId) {
      conversation = await Conversation.findOne({
        participants: { $all: [req.user?._id, receiverId] },
        product: productId,
      });
    } else {
      conversation = await Conversation.findOne({
        participants: { $all: [req.user?._id, receiverId] },
      });
    }

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user?._id, receiverId],
        product: productId,
        order: orderId,
      });

      // Automated greeting for support / delivery channels
      let protocolMsg = '';
      if (rRole === Role.ADMIN || sRole === Role.ADMIN) {
        protocolMsg =
          'Welcome to Velto Official Support. Please describe your issue in detail.';
      } else if (rRole === Role.RIDER || sRole === Role.RIDER) {
        protocolMsg =
          'Delivery Channel Active. You are now connected with your delivery partner.';
      }

      if (protocolMsg) {
        await Message.create({
          conversationId: conversation._id,
          sender: receiverId,
          receiver: req.user?._id,
          text: protocolMsg,
          isSystem: true,
        });
        conversation.lastMessage = protocolMsg;
        await conversation.save();
      }
    } else {
      if (productId && !conversation.product) conversation.product = productId;
      if (orderId && !conversation.order) conversation.order = orderId;
      await conversation.save();
    }

    const populated = await Conversation.findById(conversation._id)
      .populate('participants', 'name avatar role')
      .populate('product', 'title images')
      .populate('order', 'status totalPrice');

    if (populated) {
      populated.participants = (populated.participants as any).map((p: any) => {
        if (p.role === Role.ADMIN && p.name.toLowerCase().includes('nexbuy')) {
          p.name = 'Velto Support Team';
        }
        return p;
      });
    }

    res.status(200).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const startSupportConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = await User.findOne({ role: Role.ADMIN });
    if (!admin) {
      res.status(404).json({ success: false, message: 'Support team is currently unavailable' });
      return;
    }
    req.body.receiverId = admin._id;
    return startConversation(req, res);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getConversations = async (req: Request, res: Response): Promise<void> => {
  try {
      const query = req.user?.role === Role.ADMIN 
        ? {} 
        : { participants: { $in: [req.user?._id] } };

    const conversations = await Conversation.find(query)
      .populate('participants', 'name avatar role')
      .populate({
        path: 'product',
        select: 'title images shop',
        populate: { path: 'shop', select: 'name logo owner' },
      })
      .sort({ updatedAt: -1 });

    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          receiver: req.user?._id,
          read: false,
        });
        return { ...conv.toObject(), unreadCount };
      })
    );

    res.json({ success: true, data: conversationsWithUnread });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: conversationId } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 30);
    const skip = (page - 1) * limit;

    // Security: verify the requester is a participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new AppError('Conversation not found', 404);

    const isParticipant = conversation.participants.some(
      (p) => String(p) === String(req.user?._id) || (p as any)?._id?.toString() === String(req.user?._id)
    );
    const isSupportAccess = req.user?.role === Role.ADMIN;
    
    if (!isParticipant && !isSupportAccess) throw new AppError('Access denied', 403);

    const [messages, total] = await Promise.all([
      Message.find({ conversationId })
        .populate('sender', 'name avatar role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Message.countDocuments({ conversationId }),
    ]);

    // Return oldest-first for display, pagination newest-first for fetching
    res.json({
      success: true,
      data: messages.reverse(),
      pagination: { page, limit, total, hasMore: skip + limit < total },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId, receiverId, text } = req.body;

    if (!conversationId || !receiverId || !text) {
      throw new AppError('conversationId, receiverId, and text are required.', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      throw new AppError(`Invalid receiverId: ${receiverId}`, 400);
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new AppError(`Invalid conversationId: ${conversationId}`, 400);
    }

    const senderId = req.user?._id;
    if (!senderId) throw new AppError('Authentication context missing.', 401);

    // Security: verify sender is a participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new AppError('Conversation not found', 404);

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === senderId.toString()
    );
    const isSupportAccess = req.user?.role === Role.ADMIN;
    
    if (!isParticipant && !isSupportAccess) throw new AppError('Access denied', 403);

    const message = await Message.create({
      conversationId,
      sender: senderId,
      receiver: receiverId,
      text: text.trim(),
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: text.trim(),
      updatedAt: new Date(),
    });

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    handleError(error, res);
  }
};

export const getUnreadChatCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const unreadCount = await Message.countDocuments({
      receiver: req.user?._id,
      read: false,
    });
    res.json({ success: true, data: unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const markAllMessagesAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    await Message.updateMany({ receiver: req.user?._id, read: false }, { read: true });
    res.json({ success: true, message: 'All messages marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const markConversationAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Security: verify the requester is a participant
    const conversation = await Conversation.findById(id);
    if (!conversation) throw new AppError('Conversation not found', 404);

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === req.user?._id.toString()
    );
    const isSupportAccess = req.user?.role === Role.ADMIN;
    
    if (!isParticipant && !isSupportAccess) throw new AppError('Access denied', 403);

    await Message.updateMany(
      { conversationId: id, receiver: req.user?._id, read: false },
      { read: true }
    );

    res.json({ success: true, message: 'Conversation marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
