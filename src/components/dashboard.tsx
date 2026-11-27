
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import {
  MessageCircle,
  CircleUserRound,
  Settings,
  LogOut,
  Search,
  Plus,
  MoreVertical,
  Paperclip,
  Smile,
  Send,
  Phone,
  Video,
  CheckCheck,
  ArrowLeft,
  Users,
  UserPlus,
  LogIn,
  X,
  FileText,
  Download,
} from "lucide-react";

import { useAuth } from "../hooks/useAuth";

import {
  subscribeToUsers,
  type UserProfile,
} from "../services/userService";

import {
  getOrCreatePrivateChat,
  sendMessage,
  subscribeToMessages,
  subscribeToActiveChatUserIds,
  markChatAsRead,
  subscribeToUserLastReadAt,
  type ActiveChat,
  type ChatMessage,
} from "../services/chatService";

import {
  createGroupChat,
  joinGroupByInviteCode,
  sendGroupMessage,
  subscribeToUserGroups,
  subscribeToGroupMessages,
  markGroupAsRead,
  leaveGroup,
  type GroupChat,
  type GroupMessage,
} from "../services/groupChatService";

import {
  subscribeToUserPresence,
  type UserPresence,
} from "../services/presenceService";

import {
  uploadChatMedia,
  formatFileSize,
  detectMediaType,
  type MediaAttachment,
} from "../services/storageService";

import {
  CreateGroupModal,
  JoinGroupModal,
  GroupInviteCodeBadge,
} from "./groupChat";

import { EncryptedMedia } from "./EncryptedMedia";
import { WhatsAppLogo } from "./WhatsAppLogo";

import ThemeToggle from "./themeToggle";

// ── Helpers ───────────────────────────────────────────────────────

function formatChatTime(timestamp: number) {
  const messageDate = new Date(timestamp);
  const today = new Date();

  if (messageDate.toDateString() === today.toDateString()) {
    return messageDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (messageDate.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return messageDate.toLocaleDateString("en-GB");
}

function formatLastSeen(timestamp: number | null) {
  if (!timestamp) return "offline";

  const date = new Date(timestamp);
  const today = new Date();
  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (date.toDateString() === today.toDateString()) {
    return `last seen today at ${time}`;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === yesterday.toDateString()) {
    return `last seen yesterday at ${time}`;
  }

  return `last seen ${date.toLocaleDateString("en-GB")} at ${time}`;
}

type SidebarTab = "chats" | "groups";

// ── Dashboard ──────────────────────────────────────────────────────

function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Private chat state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedChat, setSelectedChat] = useState<UserProfile | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeChats, setActiveChats] = useState<ActiveChat[]>([]);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [selectedUserPresence, setSelectedUserPresence] =
    useState<UserPresence | null>(null);
  const [otherUserLastReadAt, setOtherUserLastReadAt] = useState(0);
  const [dashboardError, setDashboardError] = useState("");

  // Group chat state
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chats");
  const [userGroups, setUserGroups] = useState<GroupChat[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupChat | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [selectedMessageInfo, setSelectedMessageInfo] =
    useState<GroupMessage | null>(null);

  // Media upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // ── Subscriptions ──────────────────────────────────────────────

  // Fetch registered users
  useEffect(() => {
    const unsubscribe = subscribeToUsers((allUsers) => {
      const otherUsers = allUsers.filter(
        (profile) => profile.uid !== user?.uid
      );
      setUsers(otherUsers);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Get actual conversations
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToActiveChatUserIds(
      user.uid,
      (chats) => {
        setActiveChats(
          [...chats].sort(
            (a, b) => b.lastMessageAt - a.lastMessageAt
          )
        );
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Listen to selected user's presence
  useEffect(() => {
    if (!selectedChat?.uid) {
      setSelectedUserPresence(null);
      return;
    }

    const unsubscribe = subscribeToUserPresence(
      selectedChat.uid,
      (presence) => {
        setSelectedUserPresence(presence);
      }
    );

    return () => unsubscribe();
  }, [selectedChat?.uid]);

  // Listen to recipient's last read timestamp
  useEffect(() => {
    if (!selectedChat?.uid || !activeChatId) {
      setOtherUserLastReadAt(0);
      return;
    }

    const unsubscribe = subscribeToUserLastReadAt(
      selectedChat.uid,
      activeChatId,
      setOtherUserLastReadAt
    );

    return () => unsubscribe();
  }, [selectedChat?.uid, activeChatId]);

  // Listen for Firebase messages (private)
  useEffect(() => {
    if (!activeChatId || !user?.uid) return;

    const unsubscribe = subscribeToMessages(
      activeChatId,
      (newMessages) => {
        setMessages(newMessages);

        const latestMessage = newMessages[newMessages.length - 1];

        if (
          latestMessage &&
          latestMessage.senderId !== user.uid
        ) {
          markChatAsRead(user.uid, activeChatId);
        }
      }
    );

    return () => unsubscribe();
  }, [activeChatId, user?.uid]);

  // Subscribe to user's groups
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToUserGroups(user.uid, (groups) => {
      setUserGroups(groups);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Listen for group messages
  useEffect(() => {
    if (!selectedGroup || !user?.uid) return;

    const unsubscribe = subscribeToGroupMessages(
      selectedGroup.id,
      (msgs) => {
        setGroupMessages(msgs);

        const latestMessage = msgs[msgs.length - 1];
        if (
          latestMessage &&
          !latestMessage.isSystem &&
          latestMessage.senderId !== user.uid
        ) {
          markGroupAsRead(user.uid, selectedGroup.id);
        }
      }
    );

    return () => unsubscribe();
  }, [selectedGroup?.id, user?.uid]);

  // ── Handlers ───────────────────────────────────────────────────

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Select user and create/retrieve private chat
  const handleSelectChat = async (profile: UserProfile) => {
    if (!user) return;

    setSelectedChat(profile);
    setSelectedGroup(null);
    setIsNewChatOpen(false);
    setSearchText("");
    setActiveChatId(null);
    setMessages([]);
    setOtherUserLastReadAt(0);
    setDashboardError("");
    setGroupMenuOpen(false);
    clearSelectedFile();

    try {
      const chatId = await getOrCreatePrivateChat(
        user.uid,
        profile.uid
      );

      await markChatAsRead(user.uid, chatId);
      setActiveChatId(chatId);
    } catch (error) {
      console.error("Error opening chat:", error);
      setDashboardError("Failed to open conversation. Please try again.");
    }
  };

  // Select group
  const handleSelectGroup = (group: GroupChat) => {
    setSelectedGroup(group);
    setSelectedChat(null);
    setActiveChatId(null);
    setMessages([]);
    setOtherUserLastReadAt(0);
    setDashboardError("");
    setGroupMenuOpen(false);
    setSearchText("");
    clearSelectedFile();

    if (user?.uid) {
      markGroupAsRead(user.uid, group.id).catch((err) => {
        console.error("Error marking group as read:", err);
      });
    }
  };

  // Back to chats
  const handleBackToChats = () => {
    setSelectedChat(null);
    setSelectedGroup(null);
    setActiveChatId(null);
    setOtherUserLastReadAt(0);
    setDashboardError("");
    setGroupMenuOpen(false);
    clearSelectedFile();
  };

  // Clear selected media
  const clearSelectedFile = () => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setUploadProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle file selection
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setDashboardError("File size cannot exceed 10 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setDashboardError("");
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    setSelectedFile(file);
    const mediaType = detectMediaType(file.type);
    if (mediaType === "image" || mediaType === "video") {
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setFilePreviewUrl(null);
    }
  };

  // Send message (private)
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();

    const trimmedMessage = message.trim();

    if ((!trimmedMessage && !selectedFile) || !user || !activeChatId || isUploading) return;

    if (trimmedMessage.length > 5000) {
      setDashboardError("Message cannot exceed 5000 characters.");
      return;
    }

    setDashboardError("");

    try {
      let media: MediaAttachment | undefined;

      if (selectedFile) {
        setIsUploading(true);
        setUploadProgress(0);
        media = await uploadChatMedia(activeChatId, selectedFile, setUploadProgress);
      }

      await sendMessage(
        activeChatId,
        user.uid,
        trimmedMessage,
        media
      );
      setMessage("");
      clearSelectedFile();
    } catch (error) {
      console.error("Error sending message:", error);
      setDashboardError(
        error instanceof Error
          ? error.message
          : "Failed to send message. Please try again."
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // Send group message
  const handleSendGroupMessage = async (e: FormEvent) => {
    e.preventDefault();

    const trimmedMessage = message.trim();

    if ((!trimmedMessage && !selectedFile) || !user || !selectedGroup || isUploading) return;

    if (trimmedMessage.length > 5000) {
      setDashboardError("Message cannot exceed 5000 characters.");
      return;
    }

    setDashboardError("");

    try {
      let media: MediaAttachment | undefined;

      if (selectedFile) {
        setIsUploading(true);
        setUploadProgress(0);
        media = await uploadChatMedia(selectedGroup.id, selectedFile, setUploadProgress);
      }

      await sendGroupMessage(
        selectedGroup.id,
        user.uid,
        trimmedMessage,
        false,
        media
      );
      setMessage("");
      clearSelectedFile();
    } catch (error) {
      console.error("Error sending group message:", error);
      setDashboardError(
        error instanceof Error
          ? error.message
          : "Failed to send message. Please try again."
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // Create group
  const handleCreateGroup = async (
    name: string,
    description: string,
    memberIds: string[]
  ) => {
    if (!user) return;

    const groupId = await createGroupChat(
      user.uid,
      name,
      description,
      memberIds
    );

    // Auto-select the new group
    const { getGroupInfo } = await import("../services/groupChatService");
    const info = await getGroupInfo(groupId);

    if (info) {
      setSidebarTab("groups");
      setSelectedGroup(info);
      setSelectedChat(null);
      setActiveChatId(null);
    }
  };

  // Join group
  const handleJoinGroup = async (inviteCode: string) => {
    if (!user) return;

    const { groupId, groupName } = await joinGroupByInviteCode(
      user.uid,
      inviteCode
    );

    const { getGroupInfo } = await import("../services/groupChatService");
    const info = await getGroupInfo(groupId);

    if (info) {
      setSidebarTab("groups");
      setSelectedGroup(info);
      setSelectedChat(null);
      setActiveChatId(null);
    }
  };

  // Leave group
  const handleLeaveGroup = async () => {
    if (!user || !selectedGroup) return;

    try {
      await leaveGroup(user.uid, selectedGroup.id);
      setSelectedGroup(null);
      setGroupMenuOpen(false);
    } catch (error) {
      console.error("Error leaving group:", error);
      setDashboardError("Failed to leave group.");
    }
  };

  // ── Derived data ───────────────────────────────────────────────

  // Search users
  const filteredUsers = users.filter(
    (profile) =>
      activeChats.some(
        (chat) => chat.otherUserId === profile.uid
      ) &&
      profile.username
        .toLowerCase()
        .includes(searchText.toLowerCase())
  );

  // All registered users for New Chat
  const newChatFilteredUsers = users.filter((profile) =>
    profile.username
      .toLowerCase()
      .includes(searchText.toLowerCase())
  );

  // Sort conversations by latest message
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const chatA = activeChats.find(
      (chat) => chat.otherUserId === a.uid
    );

    const chatB = activeChats.find(
      (chat) => chat.otherUserId === b.uid
    );

    return (chatB?.lastMessageAt ?? 0) -
      (chatA?.lastMessageAt ?? 0);
  });

  // Decide which users to display
  const displayedUsers = isNewChatOpen
    ? newChatFilteredUsers
    : sortedUsers;

  // Filter groups by search
  const filteredGroups = userGroups.filter((g) =>
    g.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // Helper: get sender name for group messages
  const getSenderName = (senderId: string) => {
    if (senderId === user?.uid) return "You";
    const u = users.find((p) => p.uid === senderId);
    return u?.username ?? "Unknown";
  };

  const isConversationOpen = selectedChat !== null || selectedGroup !== null;

  const totalPrivateUnread = activeChats.reduce(
    (sum, chat) => sum + (chat.unreadCount ?? 0),
    0
  );
  const totalGroupUnread = userGroups.reduce(
    (sum, group) => sum + (group.unreadCount ?? 0),
    0
  );

  // Live group object (keeps participants & lastRead synced in real time)
  const currentGroup = selectedGroup
    ? (userGroups.find((g) => g.id === selectedGroup.id) ?? selectedGroup)
    : null;

  // Render media inside a message bubble (shared for private & group chats)
  const renderMessageMedia = (item: ChatMessage) => {
    if (!item.mediaUrl) return null;
    return <EncryptedMedia item={item} onImageClick={setLightboxImageUrl} />;
  };

  // Render selected file preview bar above composer
  const renderMediaPreviewBar = () => {
    if (!selectedFile) return null;
    const mediaType = detectMediaType(selectedFile.type);

    return (
      <div className="z-10 flex items-center gap-3 border-t border-[#e9edef] dark:border-[#303d45] bg-[#f8f9fa] dark:bg-[#1a2730] px-5 py-2.5 max-[640px]:px-2">
        {mediaType === "image" && filePreviewUrl ? (
          <img
            src={filePreviewUrl}
            alt={selectedFile.name}
            className="h-12 w-12 shrink-0 rounded-md object-cover"
          />
        ) : mediaType === "video" && filePreviewUrl ? (
          <video
            src={filePreviewUrl}
            className="h-12 w-12 shrink-0 rounded-md bg-black object-cover"
          />
        ) : (
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-[#00a884]/15 text-[#00a884]">
            <FileText size={22} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-xs font-medium text-[#111b21] dark:text-[#e9edef]">
            {selectedFile.name}
          </p>
          <p className="m-0 text-[11px] text-[#667781] dark:text-[#aebac1]">
            {formatFileSize(selectedFile.size)}
            {isUploading && uploadProgress !== null && ` • Uploading ${uploadProgress}%`}
          </p>
          {isUploading && uploadProgress !== null && (
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#dfe3e5] dark:bg-[#303d45]">
              <div
                className="h-full bg-[#00a884] transition-all duration-150"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>

        {!isUploading && (
          <button
            type="button"
            onClick={clearSelectedFile}
            aria-label="Remove attachment"
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-[#dfe5e7] dark:hover:bg-[#374650]"
          >
            <X size={18} />
          </button>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="grid h-dvh min-h-93.75 min-w-93.75 w-full grid-cols-[64px_minmax(300px,31%)_minmax(0,1fr)] overflow-hidden bg-[#f0f2f5] dark:bg-[#111b21] font-[Arial,Helvetica,sans-serif] text-sm leading-[1.4] text-[#111b21] dark:text-[#e9edef] max-[900px]:grid-cols-[56px_minmax(260px,36%)_minmax(0,1fr)] max-[640px]:grid-cols-[48px_minmax(0,1fr)]">

      {/* ═══ Navigation rail ═══ */}
      <aside
        aria-label="Main navigation"
        className="z-10 flex flex-col items-center justify-between border-r border-[#dfe3e5] dark:border-[#303d45] bg-[#f0f2f5] dark:bg-[#202c33] py-[18px] pb-4 max-[900px]:pt-3 max-[640px]:py-3"
      >
        <div className="flex flex-col items-center gap-[18px] max-[640px]:gap-3">
          <div
            aria-label="WhatsApp"
            className="grid h-[42px] w-[42px] shrink-0 place-items-center text-[#00a884] max-[640px]:h-9 max-[640px]:w-9"
          >
            <WhatsAppLogo size={26} />
          </div>

          {/* Chats tab */}
          <button
            title="Chats"
            aria-label="Chats"
            onClick={() => { setSidebarTab("chats"); setIsNewChatOpen(false); setSearchText(""); }}
            className={`relative grid h-[42px] w-[42px] shrink-0 cursor-pointer place-items-center rounded-xl transition-colors duration-150 max-[640px]:h-9 max-[640px]:w-9 ${sidebarTab === "chats"
              ? "bg-[#dfe5e7] dark:bg-[#374650] text-[#202c33] dark:text-[#e9edef] shadow-[inset_3px_0_0_#00a884]"
              : "text-[#54656f] dark:text-[#aebac1] hover:bg-[#dfe5e7] dark:hover:bg-[#374650] hover:text-[#202c33] dark:hover:text-white"
              }`}
          >
            <MessageCircle size={21} />
            {totalPrivateUnread > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#25d366] px-1 text-[10px] font-semibold text-white">
                {totalPrivateUnread > 99 ? "99+" : totalPrivateUnread}
              </span>
            )}
          </button>

          {/* Groups tab */}
          <button
            title="Groups"
            aria-label="Groups"
            onClick={() => { setSidebarTab("groups"); setIsNewChatOpen(false); setSearchText(""); }}
            className={`relative grid h-[42px] w-[42px] shrink-0 cursor-pointer place-items-center rounded-xl transition-colors duration-150 max-[640px]:h-9 max-[640px]:w-9 ${sidebarTab === "groups"
              ? "bg-[#dfe5e7] dark:bg-[#374650] text-[#202c33] dark:text-[#e9edef] shadow-[inset_3px_0_0_#00a884]"
              : "text-[#54656f] dark:text-[#aebac1] hover:bg-[#dfe5e7] dark:hover:bg-[#374650] hover:text-[#202c33] dark:hover:text-white"
              }`}
          >
            <Users size={21} />
            {totalGroupUnread > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#25d366] px-1 text-[10px] font-semibold text-white">
                {totalGroupUnread > 99 ? "99+" : totalGroupUnread}
              </span>
            )}
          </button>

          <button
            title="Contacts"
            aria-label="Contacts"
            className="grid h-[42px] w-[42px] shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] transition-colors duration-150 hover:bg-[#dfe5e7] dark:hover:bg-[#374650] hover:text-[#202c33] dark:hover:text-white max-[640px]:h-9 max-[640px]:w-9"
          >
            <CircleUserRound size={21} />
          </button>

          <button
            title="Settings"
            aria-label="Settings"
            className="grid h-[42px] w-[42px] shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] transition-colors duration-150 hover:bg-[#dfe5e7] dark:hover:bg-[#374650] hover:text-[#202c33] dark:hover:text-white max-[640px]:h-9 max-[640px]:w-9"
          >
            <Settings size={21} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-[18px] max-[640px]:gap-3">
          <div
            title={user?.displayName || user?.email || "User"}
            className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[#d9fdd3] text-sm font-semibold text-[#075e54] max-[640px]:h-[30px] max-[640px]:w-[30px]"
          >
            {user?.displayName?.charAt(0) ||
              user?.email?.charAt(0)?.toUpperCase() ||
              "U"}
          </div>

          <ThemeToggle />

          <button
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
            className="grid h-[42px] w-[42px] shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] transition-colors duration-150 hover:bg-[#dfe3e5] dark:hover:bg-[#374650] hover:text-[#202c33] dark:hover:text-white max-[640px]:h-9 max-[640px]:w-9"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* ═══ Chat / Group list ═══ */}
      <section
        className={`flex min-w-0 flex-col overflow-hidden border-r border-[#e9edef] dark:border-[#303d45] bg-white dark:bg-[#111b21] max-[640px]:border-r-0 ${isConversationOpen
          ? "max-[640px]:hidden"
          : "max-[640px]:flex"
          }`}
      >
        <header className="flex h-[60px] shrink-0 items-center justify-between px-5 max-[900px]:px-3 max-[640px]:px-3">
          <h1 className="m-0 text-[21px] font-bold tracking-normal text-[#111b21] dark:text-[#e9edef] max-[900px]:text-lg max-[640px]:text-lg">
            {sidebarTab === "groups"
              ? "Groups"
              : isNewChatOpen
                ? "New Chat"
                : "WhatsApp"}
          </h1>

          {sidebarTab === "groups" ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsJoinGroupOpen(true)}
                aria-label="Join group"
                title="Join group"
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] transition-colors duration-150 hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] hover:text-[#202c33] dark:hover:text-white max-[640px]:h-9 max-[640px]:w-9"
              >
                <LogIn size={19} />
              </button>
              <button
                type="button"
                onClick={() => setIsCreateGroupOpen(true)}
                aria-label="Create group"
                title="Create group"
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] transition-colors duration-150 hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] hover:text-[#202c33] dark:hover:text-white max-[640px]:h-9 max-[640px]:w-9"
              >
                <Plus size={21} />
              </button>
            </div>
          ) : isNewChatOpen ? (
            <button
              type="button"
              onClick={() => {
                setIsNewChatOpen(false);
                setSearchText("");
              }}
              aria-label="Back to chats"
              title="Back to chats"
              className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] transition-colors duration-150 hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] hover:text-[#202c33] dark:hover:text-white max-[640px]:h-9 max-[640px]:w-9"
            >
              <ArrowLeft size={21} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsNewChatOpen(true);
                setSearchText("");
              }}
              aria-label="New chat"
              title="New chat"
              className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] transition-colors duration-150 hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] hover:text-[#202c33] dark:hover:text-white max-[640px]:h-9 max-[640px]:w-9"
            >
              <Plus size={21} />
            </button>
          )}
        </header>

        {/* Search */}
        <div className="px-3 pt-1 pb-3 max-[640px]:px-2">
          <label className="flex h-9 items-center gap-3 rounded-lg bg-[#f0f2f5] dark:bg-[#202c33] px-3 text-[#667781] dark:text-[#aebac1] transition-shadow duration-150 focus-within:shadow-[0_0_0_1px_#b7c3c9] max-[640px]:gap-2 max-[640px]:px-2">
            <Search size={17} aria-hidden="true" className="shrink-0" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={
                sidebarTab === "groups"
                  ? "Search groups"
                  : "Search or start a new chat"
              }
              aria-label="Search"
              className="w-full min-w-0 border-0 bg-transparent p-0 text-[13px] text-[#111b21] dark:text-[#e9edef] outline-none placeholder:text-[#667781] dark:placeholder:text-[#8696a0] placeholder:opacity-100"
            />
          </label>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto [scrollbar-color:#c7cdd0_transparent] [scrollbar-width:thin]">
          {sidebarTab === "groups" ? (
            /* ── Group list ── */
            filteredGroups.length > 0 ? (
              filteredGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleSelectGroup(group)}
                  className={`flex min-h-[76px] w-full cursor-pointer items-center gap-[13px] border-0 border-b border-[#f0f2f5] dark:border-[#202c33] px-[14px] py-[10px] text-left transition-colors duration-150 max-[640px]:gap-2 max-[640px]:px-2 ${selectedGroup?.id === group.id
                    ? "bg-[#f0f2f5] dark:bg-[#2a3942]"
                    : "bg-white dark:bg-[#111b21] hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]"
                    }`}
                >
                  <div className="grid h-[49px] w-[49px] shrink-0 place-items-center rounded-full bg-[#00a884]/15 text-[19px] font-medium text-[#00a884] max-[900px]:h-[42px] max-[900px]:w-[42px] max-[640px]:h-[38px] max-[640px]:w-[38px] max-[640px]:text-base">
                    <Users size={22} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 max-[640px]:gap-1">
                      <h3 className="m-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-medium text-[#111b21] dark:text-[#e9edef] max-[640px]:text-sm">
                        {group.name}
                      </h3>

                      <div className="flex shrink-0 items-center gap-2 max-[640px]:gap-1">
                        <span className="whitespace-nowrap text-xs text-[#8696a0] max-[640px]:text-[10px]">
                          {formatChatTime(group.lastMessageAt)}
                        </span>

                        {(group.unreadCount ?? 0) > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25d366] px-[6px] text-[11px] font-semibold text-white max-[640px]:h-[18px] max-[640px]:min-w-[18px] max-[640px]:px-1">
                            {group.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-[#667781] dark:text-[#aebac1] max-[640px]:text-[11px]">
                      {group.lastMessage
                        ? `${getSenderName(group.lastMessageSender)}: ${group.lastMessage}`
                        : group.description || "No messages yet"}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-[18px] py-[30px] text-center text-[13px] text-[#8696a0]">
                {searchText
                  ? "No groups found"
                  : "No groups yet. Create or join one!"}
              </div>
            )
          ) : (
            /* ── Private chat list ── */
            displayedUsers.length > 0 ? (
              displayedUsers.map((profile) => (
                <button
                  key={profile.uid}
                  onClick={() => handleSelectChat(profile)}
                  className={`flex min-h-[76px] w-full cursor-pointer items-center gap-[13px] border-0 border-b border-[#f0f2f5] dark:border-[#202c33] px-[14px] py-[10px] text-left transition-colors duration-150 max-[640px]:gap-2 max-[640px]:px-2 ${selectedChat?.uid === profile.uid
                    ? "bg-[#f0f2f5] dark:bg-[#2a3942]"
                    : "bg-white dark:bg-[#111b21] hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]"
                    }`}
                >
                  <div className="grid h-[49px] w-[49px] shrink-0 place-items-center rounded-full bg-[#d9fdd3] text-[19px] font-medium text-[#075e54] max-[900px]:h-[42px] max-[900px]:w-[42px] max-[640px]:h-[38px] max-[640px]:w-[38px] max-[640px]:text-base">
                    {profile.username.charAt(0).toUpperCase() || "U"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 max-[640px]:gap-1">
                      <h3 className="m-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-medium text-[#111b21] dark:text-[#e9edef] max-[640px]:text-sm">
                        {profile.username}
                      </h3>

                      {!isNewChatOpen && (
                        <div className="flex shrink-0 items-center gap-2 max-[640px]:gap-1">
                          <span className="whitespace-nowrap text-xs text-[#8696a0] max-[640px]:text-[10px]">
                            {formatChatTime(
                              activeChats.find(
                                (chat) => chat.otherUserId === profile.uid
                              )!.lastMessageAt
                            )}
                          </span>

                          {(() => {
                            const chat = activeChats.find(
                              (item) => item.otherUserId === profile.uid
                            );

                            return chat && chat.unreadCount > 0 ? (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25d366] px-[6px] text-[11px] font-semibold text-white max-[640px]:h-[18px] max-[640px]:min-w-[18px] max-[640px]:px-1">
                                {chat.unreadCount}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>

                    <p className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-[#667781] dark:text-[#aebac1] max-[640px]:text-[11px]">
                      {isNewChatOpen
                        ? "Start a conversation"
                        : activeChats.find(
                          (chat) => chat.otherUserId === profile.uid
                        )?.lastMessage || ""}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-[18px] py-[30px] text-center text-[13px] text-[#8696a0]">
                {searchText
                  ? "No users found"
                  : isNewChatOpen
                    ? "No registered users yet"
                    : "No conversations yet"}
              </div>
            )
          )}
        </div>

        {/* Account footer */}
        <footer className="flex min-h-[50px] items-center gap-[9px] border-t border-[#e9edef] dark:border-[#303d45] bg-[#f8f9fa] dark:bg-[#202c33] px-[15px] text-[11px] text-[#667781] dark:text-[#aebac1] max-[640px]:px-2">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#00a884]" />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            Logged in as {user?.displayName || user?.email}
          </span>
        </footer>
      </section>

      {/* ═══ Conversation pane ═══ */}
      <main
        className={`relative flex min-w-0 flex-col overflow-hidden bg-[#efeae2] dark:bg-[#0b141a] bg-[radial-gradient(rgba(17,27,33,0.045)_0.7px,transparent_0.7px)] dark:bg-none bg-[length:18px_18px] ${isConversationOpen
          ? "max-[640px]:flex"
          : "max-[640px]:hidden"
          }`}
      >
        {/* ── GROUP conversation ── */}
        {selectedGroup ? (
          <>
            {/* Group header */}
            <header className="z-20 flex h-[60px] shrink-0 items-center justify-between border-b border-[#e9edef] dark:border-[#303d45] bg-[#f0f2f5] dark:bg-[#202c33] px-[18px] pl-5 max-[900px]:px-3 max-[640px]:px-2">
              <div className="flex min-w-0 items-center gap-[13px] max-[640px]:gap-2">
                <button
                  type="button"
                  onClick={handleBackToChats}
                  aria-label="Back to chats"
                  title="Back to chats"
                  className="hidden h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-[#dfe5e7] dark:hover:bg-[#374650] max-[640px]:grid max-[640px]:h-8 max-[640px]:w-8"
                >
                  <ArrowLeft size={21} />
                </button>

                <div className="grid h-[41px] w-[41px] shrink-0 place-items-center rounded-full bg-[#00a884]/15 text-[17px] font-medium text-[#00a884] max-[640px]:h-[35px] max-[640px]:w-[35px]">
                  <Users size={20} />
                </div>

                <div className="min-w-0">
                  <h2 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-medium text-[#111b21] dark:text-[#e9edef] max-[640px]:text-sm">
                    {selectedGroup.name}
                  </h2>
                  <GroupInviteCodeBadge
                    inviteCode={currentGroup?.inviteCode ?? selectedGroup.inviteCode}
                    memberCount={
                      Object.keys(
                        currentGroup?.participants ?? selectedGroup.participants ?? {}
                      ).length
                    }
                  />
                </div>
              </div>

              <div className="relative flex shrink-0 items-center gap-[6px] text-[#54656f] dark:text-[#aebac1] max-[900px]:gap-0 max-[640px]:gap-0">
                <button
                  onClick={() => setGroupMenuOpen(!groupMenuOpen)}
                  className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] transition-colors duration-150 hover:bg-[#f0f2f5] dark:hover:bg-[#374650] hover:text-[#202c33] dark:hover:text-white max-[640px]:h-8 max-[640px]:w-8"
                  aria-label="More options"
                  title="More options"
                >
                  <MoreVertical size={20} />
                </button>

                {groupMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-30 min-w-[160px] rounded-lg bg-white dark:bg-[#233138] shadow-lg border border-[#e9edef] dark:border-[#303d45] py-1">
                    <button
                      onClick={handleLeaveGroup}
                      className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-4 py-2.5 text-sm text-red-500 hover:bg-[#f0f2f5] dark:hover:bg-[#182229]"
                    >
                      <LogOut size={16} />
                      Leave Group
                    </button>
                  </div>
                )}
              </div>
            </header>

            {/* Group description banner */}
            {selectedGroup.description && (
              <div className="z-10 border-b border-[#e9edef] dark:border-[#303d45] bg-[#f8f9fa] dark:bg-[#1a2730] px-5 py-2 text-xs text-[#667781] dark:text-[#aebac1]">
                {selectedGroup.description}
              </div>
            )}

            {/* Group messages */}
            <section className="z-0 flex flex-1 flex-col gap-[9px] overflow-y-auto px-[clamp(18px,5vw,72px)] py-6 [scrollbar-color:#c7cdd0_transparent] [scrollbar-width:thin] max-[900px]:px-5 max-[640px]:px-2 max-[640px]:py-3">
              {groupMessages.length > 0 ? (
                groupMessages.map((item) => {
                  const isSent = item.senderId === user?.uid;

                  // System message
                  if (item.isSystem) {
                    return (
                      <div
                        key={item.id}
                        className="flex w-full justify-center"
                      >
                        <div className="rounded-lg bg-[#fff5c4] dark:bg-[#3b3520] px-3 py-1.5 text-center text-[11px] text-[#54656f] dark:text-[#e9edef] shadow-none">
                          {getSenderName(item.senderId)} {item.text}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className={`flex w-full ${isSent ? "justify-end" : "justify-start"
                        }`}
                    >
                      <div
                        className={`min-w-[90px] max-w-[min(72%,620px)] rounded-lg px-[11px] pt-2 pb-[5px] shadow-[0_1px_1px_rgba(11,20,26,0.13)] max-[640px]:max-w-[90%] ${isSent
                          ? "rounded-tr-[2px] bg-[#d9fdd3] dark:bg-[#005c4b]"
                          : "rounded-tl-[2px] bg-white dark:bg-[#202c33]"
                          }`}
                      >
                        {/* Sender name for received messages */}
                        {!isSent && (
                          <p className="m-0 mb-0.5 text-xs font-semibold text-[#00a884]">
                            {getSenderName(item.senderId)}
                          </p>
                        )}

                        {renderMessageMedia(item)}

                        {item.text && (
                          <p className="m-0 whitespace-pre-wrap wrap-break-word text-sm leading-[1.45] text-[#111b21] dark:text-[#e9edef] [overflow-wrap:anywhere]">
                            {item.text}
                          </p>
                        )}

                        <div className="mt-[3px] flex items-center justify-end gap-[3px] text-[10px] leading-none text-[#667781] dark:text-[#aebac1]">
                          <span>
                            {new Date(item.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>

                          {isSent && (() => {
                            const otherIds = Object.keys(
                              currentGroup?.participants ?? {}
                            ).filter((uid) => uid !== user?.uid);
                            const lastReadMap = currentGroup?.lastRead ?? {};
                            const isReadByAll =
                              otherIds.length > 0 &&
                              otherIds.every(
                                (uid) => (lastReadMap[uid] ?? 0) >= item.createdAt
                              );

                            return (
                              <button
                                type="button"
                                onClick={() => setSelectedMessageInfo(item)}
                                title="Message info (Read by)"
                                aria-label="Message info"
                                className="inline-flex cursor-pointer items-center border-0 bg-transparent p-0"
                              >
                                <CheckCheck
                                  size={15}
                                  className={
                                    isReadByAll
                                      ? "text-[#53bdeb]"
                                      : "text-[#8696a0]"
                                  }
                                />
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="m-auto flex items-center gap-[7px] self-center rounded-lg bg-[#fff5c4] dark:bg-[#3b3520] px-[13px] py-[9px] text-center text-[13px] text-[#54656f] dark:text-[#e9edef] shadow-none max-[640px]:mx-1">
                  <span className="shrink-0 text-[#8696a0]">👥</span>
                  <span className="break-words">
                    Welcome to {selectedGroup.name}! Start the conversation.
                  </span>
                </div>
              )}
            </section>

            {/* Error */}
            {dashboardError && (
              <div className="absolute bottom-[75px] left-1/2 z-20 -translate-x-1/2 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700 shadow">
                {dashboardError}
              </div>
            )}

            {renderMediaPreviewBar()}

            {/* Group message composer */}
            <form
              onSubmit={handleSendGroupMessage}
              className="z-10 flex min-h-[70px] shrink-0 items-center gap-2 bg-[#f0f2f5] dark:bg-[#202c33] px-5 py-[10px] max-[900px]:gap-[3px] max-[900px]:px-[10px] max-[640px]:gap-1 max-[640px]:px-1 max-[640px]:py-2"
            >
              <button
                type="button"
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] transition-colors duration-150 hover:bg-[#e4e6e7] dark:hover:bg-[#374650] hover:text-[#202c33] dark:hover:text-white max-[640px]:h-8 max-[640px]:w-8"
                aria-label="Emoji"
              >
                <Smile size={22} />
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] transition-colors duration-150 hover:bg-[#e4e6e7] dark:hover:bg-[#374650] hover:text-[#202c33] dark:hover:text-white disabled:cursor-not-allowed max-[640px]:h-8 max-[640px]:w-8"
                aria-label="Attach file"
                title="Attach photo, video, or document"
              >
                <Paperclip size={21} />
              </button>

              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={selectedFile ? "Add a caption (optional)" : "Type a message"}
                aria-label="Type a message"
                disabled={isUploading}
                maxLength={5000}
                className="h-[42px] min-w-0 flex-1 rounded-lg border-0 bg-white dark:bg-[#2a3942] px-4 text-sm text-[#111b21] dark:text-[#e9edef] outline-none transition-shadow duration-150 placeholder:text-[#8696a0] dark:placeholder:text-[#aebac1] focus:shadow-[0_0_0_1px_#b7c3c9] disabled:cursor-not-allowed max-[640px]:h-[38px] max-[640px]:px-2 max-[640px]:text-xs"
              />

              <button
                type="submit"
                disabled={(!message.trim() && !selectedFile) || isUploading}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-0 transition-colors duration-150 max-[640px]:h-8 max-[640px]:w-8 ${(!message.trim() && !selectedFile) || isUploading
                  ? "cursor-not-allowed bg-transparent text-[#bfc9ce]"
                  : "cursor-pointer bg-[#00a884] text-white hover:bg-[#008f72]"
                  }`}
                aria-label="Send message"
              >
                <Send size={19} />
              </button>
            </form>
          </>
        ) : selectedChat ? (
          /* ── PRIVATE conversation ── */
          <>
            {/* Conversation header */}
            <header className="z-10 flex h-[60px] shrink-0 items-center justify-between border-b border-[#e9edef] dark:border-[#303d45] bg-[#f0f2f5] dark:bg-[#202c33] px-[18px] pl-5 max-[900px]:px-3 max-[640px]:px-2">
              <div className="flex min-w-0 items-center gap-[13px] max-[640px]:gap-2">
                <button
                  type="button"
                  onClick={handleBackToChats}
                  aria-label="Back to chats"
                  title="Back to chats"
                  className="hidden h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-[#dfe5e7] dark:hover:bg-[#374650] max-[640px]:grid max-[640px]:h-8 max-[640px]:w-8"
                >
                  <ArrowLeft size={21} />
                </button>

                <div className="grid h-[41px] w-[41px] shrink-0 place-items-center rounded-full bg-[#d9fdd3] text-[17px] font-medium text-[#075e54] max-[640px]:h-[35px] max-[640px]:w-[35px]">
                  {selectedChat.username.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <h2 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-medium text-[#111b21] dark:text-[#e9edef] max-[640px]:text-sm">
                    {selectedChat.username}
                  </h2>

                  <p className="mt-0.5 text-xs text-[#667781] dark:text-[#aebac1] max-[640px]:text-[10px]">
                    {selectedUserPresence?.isOnline
                      ? "online"
                      : formatLastSeen(selectedUserPresence?.lastOnline ?? null)}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-[6px] text-[#54656f] dark:text-[#aebac1] max-[900px]:gap-0 max-[640px]:gap-0">
                <button
                  className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] transition-colors duration-150 hover:bg-[#f0f2f5] dark:hover:bg-[#374650] hover:text-[#202c33] dark:hover:text-white max-[640px]:h-8 max-[640px]:w-8"
                  aria-label="Voice call"
                  title="Voice call"
                >
                  <Phone size={19} />
                </button>

                <button
                  className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] transition-colors duration-150 hover:bg-[#f0f2f5] dark:hover:bg-[#374650] hover:text-[#202c33] dark:hover:text-white max-[640px]:h-8 max-[640px]:w-8"
                  aria-label="Video call"
                  title="Video call"
                >
                  <Video size={20} />
                </button>

                <button
                  className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] transition-colors duration-150 hover:bg-[#f0f2f5] dark:hover:bg-[#374650] hover:text-[#202c33] dark:hover:text-white max-[640px]:h-8 max-[640px]:w-8"
                  aria-label="More options"
                  title="More options"
                >
                  <MoreVertical size={20} />
                </button>
              </div>
            </header>

            {/* Messages */}
            <section className="z-0 flex flex-1 flex-col gap-[9px] overflow-y-auto px-[clamp(18px,5vw,72px)] py-6 [scrollbar-color:#c7cdd0_transparent] [scrollbar-width:thin] max-[900px]:px-5 max-[640px]:px-2 max-[640px]:py-3">
              {activeChatId === null ? (
                <div className="m-auto self-center rounded-lg bg-white/90 dark:bg-[#202c33] px-[13px] py-[9px] text-center text-[13px] text-[#54656f] dark:text-[#e9edef] shadow-[0_1px_1px_rgba(11,20,26,0.1)]">
                  Opening conversation...
                </div>
              ) : messages.length > 0 ? (
                messages.map((item) => {
                  const isSent = item.senderId === user?.uid;
                  const isRead =
                    isSent && item.createdAt <= otherUserLastReadAt;

                  return (
                    <div
                      key={item.id}
                      className={`flex w-full ${isSent ? "justify-end" : "justify-start"
                        }`}
                    >
                      <div
                        className={`min-w-[90px] max-w-[min(72%,620px)] rounded-lg px-[11px] pt-2 pb-[5px] shadow-[0_1px_1px_rgba(11,20,26,0.13)] max-[640px]:max-w-[90%] ${isSent
                          ? "rounded-tr-[2px] bg-[#d9fdd3] dark:bg-[#005c4b]"
                          : "rounded-tl-[2px] bg-white dark:bg-[#202c33]"
                          }`}
                      >
                        {renderMessageMedia(item)}

                        {item.text && (
                          <p className="m-0 whitespace-pre-wrap wrap-break-word text-sm leading-[1.45] text-[#111b21] dark:text-[#e9edef] [overflow-wrap:anywhere]">
                            {item.text}
                          </p>
                        )}

                        <div className="mt-[3px] flex items-center justify-end gap-[3px] text-[10px] leading-none text-[#667781] dark:text-[#aebac1]">
                          <span>
                            {new Date(item.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>

                          {isSent && (
                            <CheckCheck
                              size={15}
                              className={
                                isRead
                                  ? "text-[#53bdeb]"
                                  : "text-[#8696a0]"
                              }
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="m-auto flex items-center gap-[7px] self-center rounded-lg bg-[#fff5c4] dark:bg-[#3b3520] px-[13px] py-[9px] text-center text-[13px] text-[#54656f] dark:text-[#e9edef] shadow-none max-[640px]:mx-1">
                  <span className="shrink-0 text-[#8696a0]">🔒</span>
                  <span className="break-words">
                    Start a conversation with {selectedChat.username}
                  </span>
                </div>
              )}
            </section>

            {/* Dashboard error message */}
            {dashboardError && (
              <div className="absolute bottom-[75px] left-1/2 z-20 -translate-x-1/2 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700 shadow">
                {dashboardError}
              </div>
            )}

            {renderMediaPreviewBar()}

            {/* Message composer */}
            <form
              onSubmit={handleSendMessage}
              className="z-10 flex min-h-[70px] shrink-0 items-center gap-2 bg-[#f0f2f5] dark:bg-[#202c33] px-5 py-[10px] max-[900px]:gap-[3px] max-[900px]:px-[10px] max-[640px]:gap-1 max-[640px]:px-1 max-[640px]:py-2"
            >
              <button
                type="button"
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] transition-colors duration-150 hover:bg-[#e4e6e7] dark:hover:bg-[#374650] hover:text-[#202c33] dark:hover:text-white max-[640px]:h-8 max-[640px]:w-8"
                aria-label="Emoji"
              >
                <Smile size={22} />
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!activeChatId || isUploading}
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] transition-colors duration-150 hover:bg-[#e4e6e7] dark:hover:bg-[#374650] hover:text-[#202c33] dark:hover:text-white disabled:cursor-not-allowed max-[640px]:h-8 max-[640px]:w-8"
                aria-label="Attach file"
                title="Attach photo, video, or document"
              >
                <Paperclip size={21} />
              </button>

              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={selectedFile ? "Add a caption (optional)" : "Type a message"}
                aria-label="Type a message"
                disabled={!activeChatId || isUploading}
                maxLength={5000}
                className="h-[42px] min-w-0 flex-1 rounded-lg border-0 bg-white dark:bg-[#2a3942] px-4 text-sm text-[#111b21] dark:text-[#e9edef] outline-none transition-shadow duration-150 placeholder:text-[#8696a0] dark:placeholder:text-[#aebac1] focus:shadow-[0_0_0_1px_#b7c3c9] disabled:cursor-not-allowed max-[640px]:h-[38px] max-[640px]:px-2 max-[640px]:text-xs"
              />

              <button
                type="submit"
                disabled={!activeChatId || (!message.trim() && !selectedFile) || isUploading}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-0 transition-colors duration-150 max-[640px]:h-8 max-[640px]:w-8 ${!activeChatId || (!message.trim() && !selectedFile) || isUploading
                  ? "cursor-not-allowed bg-transparent text-[#bfc9ce]"
                  : "cursor-pointer bg-[#00a884] text-white hover:bg-[#008f72]"
                  }`}
                aria-label="Send message"
              >
                <Send size={19} />
              </button>
            </form>
          </>
        ) : (
          /* ── Empty state ── */
          <div className="flex flex-1 flex-col items-center justify-center border-b-[5px] border-[#00a884] bg-[#f8f9fa] dark:bg-[#111b21] px-[30px] py-[30px] text-center max-[640px]:hidden">
            <div className="mb-[25px] grid h-[170px] w-[170px] place-items-center rounded-full border border-[#e8edef] dark:border-[#303d45] bg-[#f0f2f5] dark:bg-[#202c33] text-[#00a884]">
              <WhatsAppLogo size={72} />
            </div>

            <h2 className="m-0 text-[30px] font-light tracking-normal text-[#41525d] dark:text-[#e9edef]">
              WhatsApp Web
            </h2>

            <p className="mt-3 max-w-[420px] text-sm text-[#667781] dark:text-[#aebac1]">
              Send and receive messages without keeping your phone online.
            </p>

            <div className="mt-[58px] flex items-center gap-[6px] text-xs text-[#8696a0] dark:text-[#8696a0]">
              <span className="shrink-0">🔒</span>
              <span>Your personal messages are private</span>
            </div>
          </div>
        )}
      </main>

      {/* ═══ Modals ═══ */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onCreateGroup={handleCreateGroup}
        users={users}
        currentUserId={user?.uid ?? ""}
      />

      <JoinGroupModal
        isOpen={isJoinGroupOpen}
        onClose={() => setIsJoinGroupOpen(false)}
        onJoinGroup={handleJoinGroup}
      />

      {/* Hidden file input for media uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Fullscreen image lightbox */}
      {lightboxImageUrl && (
        <div
          onClick={() => setLightboxImageUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <button
            type="button"
            onClick={() => setLightboxImageUrl(null)}
            aria-label="Close image preview"
            className="absolute right-4 top-4 grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X size={22} />
          </button>
          <img
            src={lightboxImageUrl}
            alt="Full preview"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] max-w-[90vw] rounded-lg object-contain"
          />
        </div>
      )}

      {/* Group Message Info (Read Receipts) Modal */}
      {selectedMessageInfo && currentGroup && (() => {
        const otherIds = Object.keys(currentGroup.participants ?? {}).filter(
          (uid) => uid !== user?.uid
        );
        const lastReadMap = currentGroup.lastRead ?? {};
        const readBy = otherIds.filter(
          (uid) => (lastReadMap[uid] ?? 0) >= selectedMessageInfo.createdAt
        );
        const pendingBy = otherIds.filter(
          (uid) => (lastReadMap[uid] ?? 0) < selectedMessageInfo.createdAt
        );

        return (
          <div
            onClick={() => setSelectedMessageInfo(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-xl bg-white dark:bg-[#202c33] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-[#e9edef] dark:border-[#303d45] px-5 py-3.5">
                <h3 className="m-0 text-base font-semibold text-[#111b21] dark:text-[#e9edef]">
                  Message Info
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedMessageInfo(null)}
                  aria-label="Close"
                  className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-[#f0f2f5] dark:hover:bg-[#374650]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-[65dvh] overflow-y-auto p-5 space-y-4">
                <div className="rounded-lg bg-[#d9fdd3] dark:bg-[#005c4b] px-3 py-2 text-xs text-[#111b21] dark:text-[#e9edef]">
                  {selectedMessageInfo.text ||
                    selectedMessageInfo.fileName ||
                    "Media attachment"}
                </div>

                {/* Read by */}
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#53bdeb]">
                    <CheckCheck size={15} />
                    <span>Read by ({readBy.length})</span>
                  </div>
                  {readBy.length > 0 ? (
                    <ul className="m-0 list-none space-y-2 p-0">
                      {readBy.map((uid) => (
                        <li
                          key={uid}
                          className="flex items-center justify-between text-sm text-[#111b21] dark:text-[#e9edef]"
                        >
                          <span>{getSenderName(uid)}</span>
                          <span className="text-[11px] text-[#667781] dark:text-[#aebac1]">
                            {formatChatTime(lastReadMap[uid])}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="m-0 text-xs text-[#8696a0]">No one yet</p>
                  )}
                </div>

                {/* Delivered to / Pending */}
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#8696a0]">
                    <CheckCheck size={15} />
                    <span>Delivered to ({pendingBy.length})</span>
                  </div>
                  {pendingBy.length > 0 ? (
                    <ul className="m-0 list-none space-y-1.5 p-0">
                      {pendingBy.map((uid) => (
                        <li
                          key={uid}
                          className="text-sm text-[#667781] dark:text-[#aebac1]"
                        >
                          {getSenderName(uid)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="m-0 text-xs text-[#8696a0]">
                      Read by everyone
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default Dashboard;
