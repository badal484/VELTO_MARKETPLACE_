export enum SocketEvent {
  JOIN_CONVERSATION = 'join_conversation',
  SEND_MESSAGE = 'send_message',
  RECEIVE_MESSAGE = 'receive_message',
  NEW_MESSAGE_NOTIFICATION = 'new_message_notification',
  TYPING = 'typing',
  WALLET_UPDATED = 'wallet_updated',
  USER_STATE_UPDATED = 'user_state_updated',
  ORDER_STATUS_UPDATED = 'order_status_updated',
  NEW_ORDER_FOR_SELLER = 'new_order_for_seller',
  NEW_APPLICATION = 'new_application',
}
