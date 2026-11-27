import {
  ref,
  get,
  set,
  push,
  update,
  onValue,
  remove,
} from "firebase/database";

import { database } from "./firebase";
import type { ChatMessage } from "./chatService";
import { getMediaPreviewLabel, type MediaAttachment } from "./storageService";

// ── Types ──────────────────────────────────────────────────────────

export type GroupChat = {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: number;
  participants: Record<string, boolean>;
  lastRead?: Record<string, number>;
  lastMessage: string;
  lastMessageAt: number;
  lastMessageSender: string;
  inviteCode: string;
  unreadCount?: number;
};

// ── Helpers ────────────────────────────────────────────────────────

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ── Create Group ───────────────────────────────────────────────────

export async function createGroupChat(
  creatorId: string,
  groupName: string,
  description: string,
  memberIds: string[] // initial members (excluding the creator)
): Promise<string> {
  const groupsRef = ref(database, "group_chats");
  const newGroupRef = push(groupsRef);
  const groupId = newGroupRef.key!;

  const participants: Record<string, boolean> = {
    [creatorId]: true,
  };

  memberIds.forEach((id) => {
    participants[id] = true;
  });

  const inviteCode = generateInviteCode();

  const now = Date.now();

  const groupData: Omit<GroupChat, "id"> = {
    name: groupName.trim(),
    description: description.trim(),
    createdBy: creatorId,
    createdAt: now,
    participants,
    lastRead: {
      [creatorId]: now,
    },
    lastMessage: "",
    lastMessageAt: now,
    lastMessageSender: "",
    inviteCode,
  };

  const updates: Record<string, unknown> = {};

  // Save the group
  updates[`group_chats/${groupId}`] = groupData;

  // Add to each participant's userGroups
  Object.keys(participants).forEach((uid) => {
    updates[`userGroups/${uid}/${groupId}`] = true;
  });

  await update(ref(database), updates);

  // Send a system message
  await sendGroupMessage(
    groupId,
    creatorId,
    `Group "${groupName}" created`,
    true
  );

  return groupId;
}

// ── Join Group by Invite Code ──────────────────────────────────────

export async function joinGroupByInviteCode(
  userId: string,
  inviteCode: string
): Promise<{ groupId: string; groupName: string }> {
  const groupsRef = ref(database, "group_chats");
  const snapshot = await get(groupsRef);

  if (!snapshot.exists()) {
    throw new Error("No groups found. The invite code is invalid.");
  }

  const groups = snapshot.val() as Record<string, Omit<GroupChat, "id">>;

  const entry = Object.entries(groups).find(
    ([, group]) => group.inviteCode === inviteCode
  );

  if (!entry) {
    throw new Error("Invalid invite code. Please check and try again.");
  }

  const [groupId, group] = entry;

  // Already a member?
  if (group.participants?.[userId]) {
    return { groupId, groupName: group.name };
  }

  const updates: Record<string, unknown> = {};
  updates[`group_chats/${groupId}/participants/${userId}`] = true;
  updates[`group_chats/${groupId}/lastRead/${userId}`] = Date.now();
  updates[`userGroups/${userId}/${groupId}`] = true;

  await update(ref(database), updates);

  // System message
  await sendGroupMessage(groupId, userId, "joined the group", true);

  return { groupId, groupName: group.name };
}

// ── Leave Group ────────────────────────────────────────────────────
// Combined into a single atomic update so the system message is written
// BEFORE the participant is removed (Firebase evaluates multi-path
// updates against the pre-update state of the database).

export async function leaveGroup(
  userId: string,
  groupId: string
): Promise<void> {
  const messagesRef = ref(database, `messages/${groupId}`);
  const newMessageRef = push(messagesRef);

  const now = Date.now();

  const updates: Record<string, unknown> = {};

  // System message (evaluated while user is still a participant)
  updates[`messages/${groupId}/${newMessageRef.key}`] = {
    senderId: userId,
    text: "left the group",
    createdAt: now,
    isSystem: true,
  };

  // Update group metadata
  updates[`group_chats/${groupId}/lastMessage`] = "left the group";
  updates[`group_chats/${groupId}/lastMessageAt`] = now;
  updates[`group_chats/${groupId}/lastMessageSender`] = userId;

  // Remove from participants, lastRead, and userGroups
  updates[`group_chats/${groupId}/participants/${userId}`] = null;
  updates[`group_chats/${groupId}/lastRead/${userId}`] = null;
  updates[`userGroups/${userId}/${groupId}`] = null;

  await update(ref(database), updates);
}

// ── Send Group Message ─────────────────────────────────────────────

export async function sendGroupMessage(
  groupId: string,
  senderId: string,
  text: string,
  isSystem = false,
  media?: MediaAttachment
): Promise<void> {
  const messagesRef = ref(database, `messages/${groupId}`);
  const newMessageRef = push(messagesRef);

  const messageData: Record<string, unknown> = {
    senderId,
    text,
    createdAt: Date.now(),
    isSystem,
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

  updates[`messages/${groupId}/${newMessageRef.key}`] = messageData;
  updates[`group_chats/${groupId}/lastMessage`] = lastMessagePreview;
  updates[`group_chats/${groupId}/lastMessageAt`] = messageData.createdAt;
  updates[`group_chats/${groupId}/lastMessageSender`] = senderId;

  await update(ref(database), updates);
}

// ── Mark Group As Read ──────────────────────────────────────────────

export async function markGroupAsRead(
  userId: string,
  groupId: string
): Promise<void> {
  const lastReadRef = ref(
    database,
    `group_chats/${groupId}/lastRead/${userId}`
  );
  await set(lastReadRef, Date.now());
}

// ── Subscribe to User's Groups ─────────────────────────────────────

export function subscribeToUserGroups(
  userId: string,
  callback: (groups: GroupChat[]) => void
) {
  const userGroupsRef = ref(database, `userGroups/${userId}`);

  const groupUnsubscribers = new Map<string, () => void>();
  const messageUnsubscribers = new Map<string, () => void>();
  const groupsMap = new Map<string, GroupChat>();
  const messagesByGroup = new Map<string, GroupMessage[]>();

  const notify = () => {
    const withUnread = [...groupsMap.values()].map((group) => {
      const messages = messagesByGroup.get(group.id) ?? [];
      const lastReadAt = group.lastRead?.[userId] ?? 0;
      const unreadCount = messages.filter(
        (m) =>
          !m.isSystem &&
          m.senderId !== userId &&
          m.createdAt > lastReadAt
      ).length;

      return { ...group, unreadCount };
    });

    const sorted = withUnread.sort(
      (a, b) => b.lastMessageAt - a.lastMessageAt
    );
    callback(sorted);
  };

  const unsubscribeUserGroups = onValue(userGroupsRef, (snapshot) => {
    const data = snapshot.val() as Record<string, boolean> | null;
    const currentGroupIds = new Set(Object.keys(data ?? {}));

    // Clean up removed groups
    for (const [groupId, unsub] of groupUnsubscribers) {
      if (!currentGroupIds.has(groupId)) {
        unsub();
        groupUnsubscribers.delete(groupId);
        messageUnsubscribers.get(groupId)?.();
        messageUnsubscribers.delete(groupId);
        groupsMap.delete(groupId);
        messagesByGroup.delete(groupId);
      }
    }

    // Subscribe to new groups
    currentGroupIds.forEach((groupId) => {
      if (groupUnsubscribers.has(groupId)) return;

      const groupRef = ref(database, `group_chats/${groupId}`);
      const messagesRef = ref(database, `messages/${groupId}`);

      const unsub = onValue(groupRef, (groupSnap) => {
        const groupData = groupSnap.val();

        if (!groupData) {
          groupsMap.delete(groupId);
        } else {
          groupsMap.set(groupId, { id: groupId, ...groupData });
        }

        notify();
      });

      const unsubMessages = onValue(messagesRef, (msgSnap) => {
        const msgData = msgSnap.val();
        const msgs: GroupMessage[] = msgData
          ? Object.entries(msgData).map(([id, message]) => ({
              id,
              ...(message as Omit<GroupMessage, "id">),
            }))
          : [];
        messagesByGroup.set(groupId, msgs);
        notify();
      });

      groupUnsubscribers.set(groupId, unsub);
      messageUnsubscribers.set(groupId, unsubMessages);
    });

    notify();
  });

  return () => {
    unsubscribeUserGroups();
    groupUnsubscribers.forEach((unsub) => unsub());
    messageUnsubscribers.forEach((unsub) => unsub());
    groupUnsubscribers.clear();
    messageUnsubscribers.clear();
    groupsMap.clear();
    messagesByGroup.clear();
  };
}

// ── Get Group Info ──────────────────────────────────────────────────

export async function getGroupInfo(
  groupId: string
): Promise<GroupChat | null> {
  const groupRef = ref(database, `group_chats/${groupId}`);
  const snapshot = await get(groupRef);

  if (!snapshot.exists()) return null;

  return { id: groupId, ...snapshot.val() } as GroupChat;
}

// ── Subscribe to Group Messages ─────────────────────────────────────
// (re-uses messages/{chatId} – same node structure as private chats)

export type GroupMessage = ChatMessage & {
  isSystem?: boolean;
};

export function subscribeToGroupMessages(
  groupId: string,
  callback: (messages: GroupMessage[]) => void
) {
  const messagesRef = ref(database, `messages/${groupId}`);

  const unsubscribe = onValue(messagesRef, (snapshot) => {
    const data = snapshot.val();

    if (!data) {
      callback([]);
      return;
    }

    const messages: GroupMessage[] = Object.entries(data).map(
      ([id, message]) => ({
        id,
        ...(message as Omit<GroupMessage, "id">),
      })
    );

    messages.sort((a, b) => a.createdAt - b.createdAt);

    callback(messages);
  });

  return unsubscribe;
}
