import { Router } from 'express';
import { 
  startConversation, 
  startSupportConversation,
  getConversations, 
  getMessages, 
  sendMessage,
  getUnreadChatCount,
  markAllMessagesAsRead,
  markConversationAsRead
} from '../controllers/chatController';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/', protect, startConversation);
router.post('/support', protect, startSupportConversation);
router.get('/unread-count', protect, getUnreadChatCount);
router.put('/read-all', protect, markAllMessagesAsRead);
router.put('/read/:id', protect, markConversationAsRead);
router.get('/conversations', protect, getConversations);
router.get('/messages/:id', protect, getMessages);
router.post('/message', protect, sendMessage);
export default router;