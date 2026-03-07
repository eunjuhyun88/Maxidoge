import type { ChatMsg } from './terminalTypes';
import { get, readonly, writable } from 'svelte/store';

export function createTerminalMessageRuntime(params: {
  initialChatMessages: ChatMsg[];
  maxChatMessages: number;
}) {
  const chatMessagesStore = writable<ChatMsg[]>(params.initialChatMessages);
  const chatFocusKeyStore = writable(0);

  function getChatMessages() {
    return get(chatMessagesStore);
  }

  function setChatMessages(messages: ChatMsg[]) {
    chatMessagesStore.set(messages);
  }

  function appendChatMessage(message: ChatMsg) {
    setChatMessages([...getChatMessages(), message]);
  }

  function appendChatMessages(messages: ChatMsg[]) {
    if (!messages.length) return;
    setChatMessages([...getChatMessages(), ...messages]);
  }

  function focusChatInput() {
    chatFocusKeyStore.update((focusKey) => focusKey + 1);
  }

  function trimChatMessages() {
    const chatMessages = getChatMessages();
    if (chatMessages.length <= params.maxChatMessages) return;
    setChatMessages(chatMessages.slice(-params.maxChatMessages));
  }

  return {
    appendChatMessage,
    appendChatMessages,
    chatFocusKey: readonly(chatFocusKeyStore),
    chatMessages: readonly(chatMessagesStore),
    focusChatInput,
    trimChatMessages,
  };
}
