import {
  ref,
  get,
  set,
  push,
  update,
  onValue,
} from "firebase/database";

import { auth, database } from "./firebase";
import { getMediaPreviewLabel, type MediaAttachment, type MediaType } from "./storageService";

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
  mediaUrl?: string;
  mediaType?: MediaType;
  fileName?: string;
  fileSize?: number;
  mediaKey?: string;
  mediaIv?: string;
  mimeType?: string;
};

export async function getOrCreatePrivateChat(
  currentUserId: string,
  otherUserId: string
) {
  const participants = [currentUserId, otherUserId].sort();
  const chatId = participants.join("_");

  const chatRef = ref(database, `chat_room/${chatId}`);
  const snapshot = await get(chatRef);

  if (!snapshot.exists()) {
    const chatData = {
      type: "private",
      participants: {
        [currentUserId]: true,
        [otherUserId]: true,
      },
      createdAt: Date.now(),
      lastMessage: "",
      lastMessageAt: Date.now(),
    };

    await set(chatRef, chatData);
  }

  // Always update userChats entries
  const updates: Record<string, unknown> = {};

  updates[`userChats/${currentUserId}/${chatId}/otherUserId`] =
    otherUserId;

  updates[`userChats/${otherUserId}/${chatId}/otherUserId`] =
    currentUserId;

  await update(ref(database), updates);

  return chatId;
}



export async function sendMessage(
  chatId: string,
  senderId: string,
  text: string,
  media?: MediaAttachment
) {
  console.log("AUTH CHECK:", {
    currentAuthUid: auth.currentUser?.uid,
    senderId,
    chatId,
  });
  const messagesRef = ref(database, `messages/${chatId}`);

  // Generate a unique message ID
  const newMessageRef = push(messagesRef);

  const messageData: Record<string, unknown> = {
    senderId,
    text,
    createdAt: Date.now(),
  };

  if (media) {
    messageData.mediaUrl = media.mediaUrl;
    messageData.mediaType = media.mediaType;
    messageData.fileName = media.fileName;
    messageData.fileSize = media.fileSize;
    messageData.mediaKey = media.mediaKey;
    messageData.mediaIv = media.mediaIv;
    messageData.mimeType = media.mimeType;
  }

  const lastMessagePreview =
    text || (media ? getMediaPreviewLabel(media) : "");

  const updates: Record<string, unknown> = {};

  // Save the message
  updates[`messages/${chatId}/${newMessageRef.key}`] = messageData;

  // Update chat's latest message
  updates[`chat_room/${chatId}/lastMessage`] = lastMessagePreview;
  updates[`chat_room/${chatId}/lastMessageAt`] = messageData.createdAt;

  await update(ref(database), updates);
}




export function subscribeToMessages(
  chatId: string,
  callback: (messages: ChatMessage[]) => void
) {
  const messagesRef = ref(database, `messages/${chatId}`);

  const unsubscribe = onValue(messagesRef, (snapshot) => {
    const data = snapshot.val();

    if (!data) {
      callback([]);
      return;
    }

    const messages: ChatMessage[] = Object.entries(data).map(
      ([id, message]) => ({
        id,
        ...(message as Omit<ChatMessage, "id">),
      })
    );

    messages.sort((a, b) => a.createdAt - b.createdAt);

    callback(messages);
  });

  return unsubscribe;
}



// Type
export type ActiveChat = {
  otherUserId: string;
  lastMessage: string;
  lastMessageAt: number;
  unreadCount: number;
};

type ChatData = {
  lastMessage: string;
  lastMessageAt: number;
};

export function subscribeToActiveChatUserIds(
  currentUserId: string,
  callback: (chats: ActiveChat[]) => void
) {
  const userChatsRef = ref(
    database,
    `userChats/${currentUserId}`
  );

  const chatUnsubscribers = new Map<string, () => void>();
  const messageUnsubscribers = new Map<string, () => void>();

  const activeChats = new Map<string, ActiveChat>();
  const latestChats = new Map<string, ChatData | null>();
  const messagesByChat = new Map<string, ChatMessage[]>();
  const lastReadAtByChat = new Map<string, number>();

  const notify = () => {
    callback([...activeChats.values()]);
  };

  // Calculate and update one chat's unread count
  const refreshChat = (
    chatId: string,
    otherUserId: string
  ) => {
    const chat = latestChats.get(chatId);
    const messages = messagesByChat.get(chatId) ?? [];
    const lastReadAt = lastReadAtByChat.get(chatId);

    if (!chat || messages.length === 0) {
      activeChats.delete(chatId);
      notify();
      return;
    }

    const unreadCount = lastReadAt
      ? messages.filter(
        item =>
          item.senderId !== currentUserId &&
          item.createdAt > lastReadAt
      ).length
      : 0;

    activeChats.set(chatId, {
      otherUserId,
      lastMessage: chat.lastMessage || "",
      lastMessageAt: chat.lastMessageAt || 0,
      unreadCount,
    });

    notify();
  };

  const unsubscribeUserChats = onValue(
    userChatsRef,
    snapshot => {
      const userChats = snapshot.val() as Record<
        string,
        {
          otherUserId: string;
          lastReadAt?: number;
        }
      > | null;

      const entries = Object.entries(userChats ?? {});

      const currentChatIds = new Set(
        entries.map(([chatId]) => chatId)
      );

      // Remove listeners for deleted chats
      for (const [chatId, unsubscribe] of chatUnsubscribers) {
        if (!currentChatIds.has(chatId)) {
          unsubscribe();
          chatUnsubscribers.delete(chatId);

          messageUnsubscribers.get(chatId)?.();
          messageUnsubscribers.delete(chatId);

          activeChats.delete(chatId);
          latestChats.delete(chatId);
          messagesByChat.delete(chatId);
          lastReadAtByChat.delete(chatId);
        }
      }

      entries.forEach(([chatId, chatData]) => {
        // Update latest read timestamp
        lastReadAtByChat.set(
          chatId,
          chatData.lastReadAt ?? 0
        );

        // Refresh existing chat when lastReadAt changes
        if (chatUnsubscribers.has(chatId)) {
          refreshChat(chatId, chatData.otherUserId);
          return;
        }

        const chatRef = ref(
          database,
          `chat_room/${chatId}`
        );

        const messagesRef = ref(
          database,
          `messages/${chatId}`
        );

        // Listen to chat details
        const unsubscribeChat = onValue(
          chatRef,
          chatSnapshot => {
            latestChats.set(chatId, chatSnapshot.val());

            refreshChat(chatId, chatData.otherUserId);
          }
        );

        // Listen to messages
        const unsubscribeMessages = onValue(
          messagesRef,
          messageSnapshot => {
            const data = messageSnapshot.val();

            const messages: ChatMessage[] = data
              ? Object.entries(data).map(([id, message]) => ({
                id,
                ...(message as Omit<ChatMessage, "id">),
              }))
              : [];

            messagesByChat.set(chatId, messages);

            refreshChat(chatId, chatData.otherUserId);
          }
        );

        chatUnsubscribers.set(chatId, unsubscribeChat);
        messageUnsubscribers.set(chatId, unsubscribeMessages);
      });

      notify();
    }
  );

  return () => {
    unsubscribeUserChats();

    chatUnsubscribers.forEach(unsubscribe => unsubscribe());
    messageUnsubscribers.forEach(unsubscribe => unsubscribe());

    chatUnsubscribers.clear();
    messageUnsubscribers.clear();

    activeChats.clear();
    latestChats.clear();
    messagesByChat.clear();
    lastReadAtByChat.clear();
  };
}



export async function markChatAsRead(
  userId: string,
  chatId: string
) {
  const lastReadAtRef = ref(
    database,
    `userChats/${userId}/${chatId}/lastReadAt`
  );

  await set(lastReadAtRef, Date.now());
}





export function subscribeToUserLastReadAt(
  userId: string,
  chatId: string,
  callback: (lastReadAt: number) => void
) {
  const lastReadAtRef = ref(
    database,
    `userChats/${userId}/${chatId}/lastReadAt`
  );

  const unsubscribe = onValue(lastReadAtRef, (snapshot) => {
    callback(snapshot.val() ?? 0);
  });

  return unsubscribe;
}
