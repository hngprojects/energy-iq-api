/**
 * `ChatSocketEvents` can be sent from the client to the server and in the reverse direction.
 * Some events
 */
export enum ChatSocketEvent {
  CHAT_ACTION = 'chat_action',
  EDITING_MESSAGE_START = 'edit_message_start',
  EDITING_MESSAGE_STOP = 'edit_message_stop',
  ERROR = 'error',
  JOIN_ACTIVE_CHATS = 'join_active_chats',
  JOINED = 'joined_chats',
  NEW_SYSTEM_MESSAGE = 'new_system_msg', // sent to the client when the user gets a reply from the chatbot
  SEND_MESSAGE = 'send_msg', // sent from the client to the server when the uer sends a message

  // Streaming events
  TOKEN_CHUNK = 'token_chunk', // each token piece from the AI
  STREAM_END = 'stream_end', // signals the end of a streaming response
}
