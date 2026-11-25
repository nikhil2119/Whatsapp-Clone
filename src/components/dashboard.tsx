
import { useEffect, useState, useRef } from "react";
import type { FormEvent } from "react";
import { signOut } from "firebase/auth";
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
} from "lucide-react";

import { auth } from "../services/firebase";
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
  type ActiveChat,
  type ChatMessage,
} from "../services/chatService";

import {
  trackPresence,
  subscribeToUserPresence,
  type UserPresence,
} from "../services/presenceService";

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

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const presenceControllerRef = useRef<ReturnType<typeof trackPresence> | null>(null);

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

  // Online or Offline
  useEffect(() => {
    if (!user?.uid) return;

    const presenceController = trackPresence(user.uid);
    presenceControllerRef.current = presenceController;

    return () => {
      presenceController.cleanup();
      presenceControllerRef.current = null;
    };
  }, [user?.uid]);

  // Listen to selected user's presence
  useEffect(() => {
    if (!selectedChat?.uid) return;

    const unsubscribe = subscribeToUserPresence(
      selectedChat.uid,
      (presence) => {
        setSelectedUserPresence(presence);
      }
    );

    return () => unsubscribe();
  }, [selectedChat?.uid]);

  // Logout
  const handleLogout = async () => {
    try {
      await presenceControllerRef.current?.cleanup();
      presenceControllerRef.current = null;

      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Select user and create/retrieve private chat
  const handleSelectChat = async (profile: UserProfile) => {
    if (!user) return;

    setSelectedChat(profile);
    setIsNewChatOpen(false);
    setSearchText("");
    setActiveChatId(null);
    setMessages([]);

    try {
      const chatId = await getOrCreatePrivateChat(
        user.uid,
        profile.uid
      );

      await markChatAsRead(user.uid, chatId);
      setActiveChatId(chatId);
    } catch (error) {
      console.error("Error opening chat:", error);
    }
  };

  // Back to chats
  const handleBackToChats = () => {
    setSelectedChat(null);
  };

  // Listen for Firebase messages
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

  // Send message
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage || !user || !activeChatId) return;

    try {
      await sendMessage(
        activeChatId,
        user.uid,
        trimmedMessage
      );

      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

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

  return (
    <div className="grid h-dvh min-h-[375px] min-w-[375px] w-full grid-cols-[64px_minmax(300px,31%)_minmax(0,1fr)] overflow-hidden bg-[#f0f2f5] font-[Arial,Helvetica,sans-serif] text-sm leading-[1.4] text-[#111b21] max-[900px]:grid-cols-[56px_minmax(260px,36%)_minmax(0,1fr)] max-[640px]:grid-cols-[48px_minmax(0,1fr)]">

      {/* Navigation rail */}
      <aside
        aria-label="Main navigation"
        className="z-10 flex flex-col items-center justify-between border-r border-[#dfe3e5] bg-[#f0f2f5] py-[18px] pb-4 max-[900px]:pt-3 max-[640px]:py-3"
      >
        <div className="flex flex-col items-center gap-[18px] max-[640px]:gap-3">
          <div
            aria-label="WhatsApp"
            className="grid h-[42px] w-[42px] shrink-0 place-items-center text-[#00a884] max-[640px]:h-9 max-[640px]:w-9"
          >
            <MessageCircle size={25} strokeWidth={2.2} />
          </div>

          <button
            title="Chats"
            aria-label="Chats"
            className="grid h-[42px] w-[42px] shrink-0 cursor-pointer place-items-center rounded-xl bg-[#dfe5e7] text-[#202c33] shadow-[inset_3px_0_0_#00a884] transition-colors duration-150 max-[640px]:h-9 max-[640px]:w-9"
          >
            <MessageCircle size={21} />
          </button>

          <button
            title="Contacts"
            aria-label="Contacts"
            className="grid h-[42px] w-[42px] shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] transition-colors duration-150 hover:bg-[#dfe5e7] hover:text-[#202c33] max-[640px]:h-9 max-[640px]:w-9"
          >
            <CircleUserRound size={21} />
          </button>

          <button
            title="Settings"
            aria-label="Settings"
            className="grid h-[42px] w-[42px] shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] transition-colors duration-150 hover:bg-[#dfe5e7] hover:text-[#202c33] max-[640px]:h-9 max-[640px]:w-9"
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

          <button
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
            className="grid h-[42px] w-[42px] shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] transition-colors duration-150 hover:bg-[#dfe5e7] hover:text-[#202c33] max-[640px]:h-9 max-[640px]:w-9"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Chat list */}
      <section
        className={`flex min-w-0 flex-col overflow-hidden border-r border-[#e9edef] bg-white max-[640px]:border-r-0 ${
          selectedChat
            ? "max-[640px]:hidden"
            : "max-[640px]:flex"
        }`}
      >
        {/* List header */}
        <header className="flex h-[60px] shrink-0 items-center justify-between px-5 max-[900px]:px-3 max-[640px]:px-3">
          <h1 className="m-0 text-[21px] font-bold tracking-normal text-[#111b21] max-[900px]:text-lg max-[640px]:text-lg">
            {isNewChatOpen ? "New Chat" : "WhatsApp"}
          </h1>

          {isNewChatOpen ? (
            <button
              type="button"
              onClick={() => {
                setIsNewChatOpen(false);
                setSearchText("");
              }}
              aria-label="Back to chats"
              title="Back to chats"
              className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] transition-colors duration-150 hover:bg-[#f0f2f5] hover:text-[#202c33] max-[640px]:h-9 max-[640px]:w-9"
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
              className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] transition-colors duration-150 hover:bg-[#f0f2f5] hover:text-[#202c33] max-[640px]:h-9 max-[640px]:w-9"
            >
              <Plus size={21} />
            </button>
          )}
        </header>

        {/* Search */}
        <div className="px-3 pt-1 pb-3 max-[640px]:px-2">
          <label className="flex h-9 items-center gap-3 rounded-lg bg-[#f0f2f5] px-3 text-[#667781] transition-shadow duration-150 focus-within:shadow-[0_0_0_1px_#b7c3c9] max-[640px]:gap-2 max-[640px]:px-2">
            <Search size={17} aria-hidden="true" className="shrink-0" />

            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search or start a new chat"
              aria-label="Search users"
              className="w-full min-w-0 border-0 bg-transparent p-0 text-[13px] text-[#111b21] outline-none placeholder:text-[#667781] placeholder:opacity-100"
            />
          </label>
        </div>

        {/* Users */}
        <div className="flex-1 overflow-y-auto [scrollbar-color:#c7cdd0_transparent] [scrollbar-width:thin]">
          {displayedUsers.length > 0 ? (
            displayedUsers.map((profile) => (
              <button
                key={profile.uid}
                onClick={() => handleSelectChat(profile)}
                className={`flex min-h-[76px] w-full cursor-pointer items-center gap-[13px] border-0 border-b border-[#f0f2f5] px-[14px] py-[10px] text-left transition-colors duration-150 max-[640px]:gap-2 max-[640px]:px-2 ${
                  selectedChat?.uid === profile.uid
                    ? "bg-[#f0f2f5]"
                    : "bg-white hover:bg-[#f5f6f6]"
                }`}
              >
                {/* Avatar */}
                <div className="grid h-[49px] w-[49px] shrink-0 place-items-center rounded-full bg-[#d9fdd3] text-[19px] font-medium text-[#075e54] max-[900px]:h-[42px] max-[900px]:w-[42px] max-[640px]:h-[38px] max-[640px]:w-[38px] max-[640px]:text-base">
                  {profile.username.charAt(0).toUpperCase() || "U"}
                </div>

                {/* User details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 max-[640px]:gap-1">
                    <h3 className="m-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-medium text-[#111b21] max-[640px]:text-sm">
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

                  <p className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-[#667781] max-[640px]:text-[11px]">
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
          )}
        </div>

        {/* Account footer */}
        <footer className="flex min-h-[50px] items-center gap-[9px] border-t border-[#e9edef] bg-[#f8f9fa] px-[15px] text-[11px] text-[#667781] max-[640px]:px-2">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#00a884]" />

          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            Logged in as {user?.displayName || user?.email}
          </span>
        </footer>
      </section>

      {/* Conversation */}
      <main
        className={`relative flex min-w-0 flex-col overflow-hidden bg-[#efeae2] bg-[radial-gradient(rgba(17,27,33,0.045)_0.7px,transparent_0.7px)] bg-[length:18px_18px] ${
          selectedChat
            ? "max-[640px]:flex"
            : "max-[640px]:hidden"
        }`}
      >
        {selectedChat ? (
          <>
            {/* Conversation header */}
            <header className="z-10 flex h-[60px] shrink-0 items-center justify-between border-b border-[#e9edef] bg-[#f0f2f5] px-[18px] pl-5 max-[900px]:px-3 max-[640px]:px-2">

              <div className="flex min-w-0 items-center gap-[13px] max-[640px]:gap-2">

                {/* Back button */}
                <button
                  type="button"
                  onClick={handleBackToChats}
                  aria-label="Back to chats"
                  title="Back to chats"
                  className="hidden h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] hover:bg-[#dfe5e7] max-[640px]:grid max-[640px]:h-8 max-[640px]:w-8"
                >
                  <ArrowLeft size={21} />
                </button>

                <div className="grid h-[41px] w-[41px] shrink-0 place-items-center rounded-full bg-[#d9fdd3] text-[17px] font-medium text-[#075e54] max-[640px]:h-[35px] max-[640px]:w-[35px]">
                  {selectedChat.username.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <h2 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-medium text-[#111b21] max-[640px]:text-sm">
                    {selectedChat.username}
                  </h2>

                  <p className="mt-0.5 text-xs text-[#667781] max-[640px]:text-[10px]">
                    {selectedUserPresence?.isOnline
                      ? "online"
                      : "offline"}
                  </p>
                </div>
              </div>

              {/* Header actions */}
              <div className="flex shrink-0 items-center gap-[6px] text-[#54656f] max-[900px]:gap-0 max-[640px]:gap-0">
                <button
                  className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-[#54656f] transition-colors duration-150 hover:bg-[#f0f2f5] hover:text-[#202c33] max-[640px]:h-8 max-[640px]:w-8"
                  aria-label="Voice call"
                  title="Voice call"
                >
                  <Phone size={19} />
                </button>

                <button
                  className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-[#54656f] transition-colors duration-150 hover:bg-[#f0f2f5] hover:text-[#202c33] max-[640px]:h-8 max-[640px]:w-8"
                  aria-label="Video call"
                  title="Video call"
                >
                  <Video size={20} />
                </button>

                <button
                  className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-[#54656f] transition-colors duration-150 hover:bg-[#f0f2f5] hover:text-[#202c33] max-[640px]:h-8 max-[640px]:w-8"
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
                <div className="m-auto self-center rounded-lg bg-white/90 px-[13px] py-[9px] text-center text-[13px] text-[#54656f] shadow-[0_1px_1px_rgba(11,20,26,0.1)]">
                  Opening conversation...
                </div>
              ) : messages.length > 0 ? (
                messages.map((item) => {
                  const isSent = item.senderId === user?.uid;

                  return (
                    <div
                      key={item.id}
                      className={`flex w-full ${
                        isSent ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`min-w-[90px] max-w-[min(72%,620px)] rounded-lg px-[11px] pt-2 pb-[5px] shadow-[0_1px_1px_rgba(11,20,26,0.13)] max-[640px]:max-w-[90%] ${
                          isSent
                            ? "rounded-tr-[2px] bg-[#d9fdd3]"
                            : "rounded-tl-[2px] bg-white"
                        }`}
                      >
                        <p className="m-0 whitespace-pre-wrap break-words text-sm leading-[1.45] text-[#111b21] [overflow-wrap:anywhere]">
                          {item.text}
                        </p>

                        <div className="mt-[3px] flex items-center justify-end gap-[3px] text-[10px] leading-none text-[#667781]">
                          <span>
                            {new Date(item.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>

                          {isSent && (
                            <CheckCheck
                              size={15}
                              className="text-[#53bdeb]"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="m-auto flex items-center gap-[7px] self-center rounded-lg bg-[#fff5c4] px-[13px] py-[9px] text-center text-[13px] text-[#54656f] shadow-none max-[640px]:mx-1">
                  <span className="shrink-0 text-[#8696a0]">🔒</span>
                  <span className="break-words">
                    Start a conversation with {selectedChat.username}
                  </span>
                </div>
              )}
            </section>

            {/* Message composer */}
            <form
              onSubmit={handleSendMessage}
              className="z-10 flex min-h-[70px] shrink-0 items-center gap-2 bg-[#f0f2f5] px-5 py-[10px] max-[900px]:gap-[3px] max-[900px]:px-[10px] max-[640px]:gap-1 max-[640px]:px-1 max-[640px]:py-2"
            >
              <button
                type="button"
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] transition-colors duration-150 hover:bg-[#f0f2f5] hover:text-[#202c33] max-[640px]:h-8 max-[640px]:w-8"
                aria-label="Emoji"
              >
                <Smile size={22} />
              </button>

              <button
                type="button"
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#54656f] transition-colors duration-150 hover:bg-[#f0f2f5] hover:text-[#202c33] max-[640px]:h-8 max-[640px]:w-8"
                aria-label="Attach file"
              >
                <Paperclip size={21} />
              </button>

              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message"
                aria-label="Type a message"
                disabled={!activeChatId}
                className="h-[42px] min-w-0 flex-1 rounded-lg border-0 bg-white px-4 text-sm text-[#111b21] outline-none transition-shadow duration-150 placeholder:text-[#8696a0] focus:shadow-[0_0_0_1px_#b7c3c9] disabled:cursor-not-allowed max-[640px]:h-[38px] max-[640px]:px-2 max-[640px]:text-xs"
              />

              <button
                type="submit"
                disabled={!activeChatId || !message.trim()}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-0 transition-colors duration-150 max-[640px]:h-8 max-[640px]:w-8 ${
                  !activeChatId || !message.trim()
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
          /* Welcome screen */
          <div className="flex flex-1 flex-col items-center justify-center border-b-[5px] border-[#00a884] bg-[#f8f9fa] px-[30px] py-[30px] text-center max-[640px]:hidden">
            <div className="mb-[25px] grid h-[170px] w-[170px] place-items-center rounded-full border border-[#e8edef] bg-[#f0f2f5] text-[#00a884]">
              <MessageCircle size={64} strokeWidth={1.35} />
            </div>

            <h2 className="m-0 text-[30px] font-light tracking-normal text-[#41525d]">
              WhatsApp Web
            </h2>

            <p className="mt-3 max-w-[420px] text-sm text-[#667781]">
              Send and receive messages without keeping your phone online.
            </p>

            <div className="mt-[58px] flex items-center gap-[6px] text-xs text-[#8696a0]">
              <span className="shrink-0">🔒</span>
              <span>Your personal messages are private</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
