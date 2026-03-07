import type { ChatMsg } from './terminalTypes';

export function createTerminalMessageRuntime(params: {
  getChatMessages: () => ChatMsg[];
  setChatMessages: (messages: ChatMsg[]) => void;
  maxChatMessages: number;
  bumpChatFocusKey: () => void;
}) {
  function appendChatMessage(message: ChatMsg) {
    params.setChatMessages([...params.getChatMessages(), message]);
  }

  function appendChatMessages(messages: ChatMsg[]) {
    if (!messages.length) return;
    params.setChatMessages([...params.getChatMessages(), ...messages]);
  }

  function focusChatInput() {
    params.bumpChatFocusKey();
  }

  function trimChatMessages() {
    const chatMessages = params.getChatMessages();
    if (chatMessages.length <= params.maxChatMessages) return;
    params.setChatMessages(chatMessages.slice(-params.maxChatMessages));
  }

  return {
    appendChatMessage,
    appendChatMessages,
    focusChatInput,
    trimChatMessages,
  };
}
