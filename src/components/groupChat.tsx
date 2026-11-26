import { useState } from "react";
import type { FormEvent } from "react";
import { X, Users, UserPlus, Copy, Check } from "lucide-react";
import type { UserProfile } from "../services/userService";

// ── Create Group Modal ─────────────────────────────────────────────

type CreateGroupModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (
    name: string,
    description: string,
    memberIds: string[]
  ) => Promise<void>;
  users: UserProfile[];
  currentUserId: string;
};

export function CreateGroupModal({
  isOpen,
  onClose,
  onCreateGroup,
  users,
  currentUserId,
}: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set()
  );
  const [searchText, setSearchText] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const filteredUsers = users.filter(
    (u) =>
      u.uid !== currentUserId &&
      u.username.toLowerCase().includes(searchText.toLowerCase())
  );

  const toggleMember = (uid: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!groupName.trim()) {
      setError("Group name is required.");
      return;
    }

    if (groupName.trim().length > 50) {
      setError("Group name cannot exceed 50 characters.");
      return;
    }

    setIsCreating(true);

    try {
      await onCreateGroup(
        groupName.trim(),
        description.trim(),
        [...selectedMembers]
      );

      // Reset
      setGroupName("");
      setDescription("");
      setSelectedMembers(new Set());
      setSearchText("");
      onClose();
    } catch (err) {
      console.error("Error creating group:", err);
      setError("Failed to create group. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#202c33] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e9edef] dark:border-[#303d45] px-5 py-4">
          <div className="flex items-center gap-3">
            <Users size={20} className="text-[#00a884]" />
            <h2 className="m-0 text-lg font-semibold text-[#111b21] dark:text-[#e9edef]">
              New Group
            </h2>
          </div>

          <button
            onClick={onClose}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-[#f0f2f5] dark:hover:bg-[#374650]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          {/* Group Name */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-[#8696a0] dark:text-[#aebac1]">
              Group Name *
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name"
              maxLength={50}
              className="h-10 w-full rounded-lg border-0 bg-[#f0f2f5] dark:bg-[#2a3942] px-3 text-sm text-[#111b21] dark:text-[#e9edef] outline-none placeholder:text-[#8696a0] dark:placeholder:text-[#aebac1] focus:shadow-[0_0_0_1px_#00a884]"
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-[#8696a0] dark:text-[#aebac1]">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this group about?"
              maxLength={120}
              className="h-10 w-full rounded-lg border-0 bg-[#f0f2f5] dark:bg-[#2a3942] px-3 text-sm text-[#111b21] dark:text-[#e9edef] outline-none placeholder:text-[#8696a0] dark:placeholder:text-[#aebac1] focus:shadow-[0_0_0_1px_#00a884]"
            />
          </div>

          {/* Add Members */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-[#8696a0] dark:text-[#aebac1]">
              Add Members (optional)
            </label>

            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search users"
              className="mb-2 h-9 w-full rounded-lg border-0 bg-[#f0f2f5] dark:bg-[#2a3942] px-3 text-sm text-[#111b21] dark:text-[#e9edef] outline-none placeholder:text-[#8696a0] dark:placeholder:text-[#aebac1] focus:shadow-[0_0_0_1px_#00a884]"
            />

            {/* Selected chips */}
            {selectedMembers.size > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {[...selectedMembers].map((uid) => {
                  const u = users.find((p) => p.uid === uid);
                  return (
                    <span
                      key={uid}
                      className="flex items-center gap-1 rounded-full bg-[#d9fdd3] dark:bg-[#005c4b] px-2.5 py-0.5 text-xs font-medium text-[#075e54] dark:text-[#e9edef]"
                    >
                      {u?.username ?? uid}
                      <button
                        type="button"
                        onClick={() => toggleMember(uid)}
                        className="ml-0.5 cursor-pointer text-[#075e54] dark:text-[#aebac1] hover:text-red-500"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* User list */}
            <div className="max-h-36 overflow-y-auto rounded-lg bg-[#f0f2f5] dark:bg-[#111b21] [scrollbar-width:thin]">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((profile) => (
                  <button
                    key={profile.uid}
                    type="button"
                    onClick={() => toggleMember(profile.uid)}
                    className={`flex w-full cursor-pointer items-center gap-3 border-0 px-3 py-2 text-left transition-colors ${
                      selectedMembers.has(profile.uid)
                        ? "bg-[#d9fdd3]/50 dark:bg-[#005c4b]/30"
                        : "hover:bg-[#e9edef] dark:hover:bg-[#202c33]"
                    }`}
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#d9fdd3] text-sm font-medium text-[#075e54]">
                      {profile.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm text-[#111b21] dark:text-[#e9edef]">
                      {profile.username}
                    </span>
                    {selectedMembers.has(profile.uid) && (
                      <Check size={16} className="text-[#00a884]" />
                    )}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-center text-xs text-[#8696a0]">
                  No users found
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-3 rounded-lg bg-red-100 dark:bg-red-900/30 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isCreating || !groupName.trim()}
            className={`h-10 w-full rounded-lg border-0 text-sm font-semibold transition-colors ${
              isCreating || !groupName.trim()
                ? "cursor-not-allowed bg-[#b7c3c9] text-white"
                : "cursor-pointer bg-[#00a884] text-white hover:bg-[#008f72]"
            }`}
          >
            {isCreating ? "Creating..." : "Create Group"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Join Group Modal ───────────────────────────────────────────────

type JoinGroupModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onJoinGroup: (inviteCode: string) => Promise<void>;
};

export function JoinGroupModal({
  isOpen,
  onClose,
  onJoinGroup,
}: JoinGroupModalProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!inviteCode.trim()) {
      setError("Please enter an invite code.");
      return;
    }

    setIsJoining(true);

    try {
      await onJoinGroup(inviteCode.trim());
      setInviteCode("");
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to join group. Please try again."
      );
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-[#202c33] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e9edef] dark:border-[#303d45] px-5 py-4">
          <div className="flex items-center gap-3">
            <UserPlus size={20} className="text-[#00a884]" />
            <h2 className="m-0 text-lg font-semibold text-[#111b21] dark:text-[#e9edef]">
              Join Group
            </h2>
          </div>

          <button
            onClick={onClose}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-[#f0f2f5] dark:hover:bg-[#374650]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-[#8696a0] dark:text-[#aebac1]">
              Invite Code
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Paste invite code here"
              className="h-10 w-full rounded-lg border-0 bg-[#f0f2f5] dark:bg-[#2a3942] px-3 text-center text-sm font-mono tracking-widest text-[#111b21] dark:text-[#e9edef] outline-none placeholder:text-[#8696a0] dark:placeholder:text-[#aebac1] placeholder:tracking-normal placeholder:font-sans focus:shadow-[0_0_0_1px_#00a884]"
            />
          </div>

          {error && (
            <div className="mb-3 rounded-lg bg-red-100 dark:bg-red-900/30 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isJoining || !inviteCode.trim()}
            className={`h-10 w-full rounded-lg border-0 text-sm font-semibold transition-colors ${
              isJoining || !inviteCode.trim()
                ? "cursor-not-allowed bg-[#b7c3c9] text-white"
                : "cursor-pointer bg-[#00a884] text-white hover:bg-[#008f72]"
            }`}
          >
            {isJoining ? "Joining..." : "Join Group"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Group Info Panel (shown in conversation header area) ───────────

type GroupInfoPanelProps = {
  inviteCode: string;
  memberCount: number;
};

export function GroupInviteCodeBadge({
  inviteCode,
  memberCount,
}: GroupInfoPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = inviteCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#667781] dark:text-[#aebac1]">
        {memberCount} members
      </span>
      <button
        onClick={handleCopy}
        title={copied ? "Copied!" : `Copy invite code: ${inviteCode}`}
        className="flex items-center gap-1 cursor-pointer rounded-md bg-[#e7f8f0] dark:bg-[#005c4b]/40 px-2 py-0.5 text-[10px] font-mono text-[#00a884] hover:bg-[#d9fdd3] dark:hover:bg-[#005c4b]/60 transition-colors"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? "Copied" : inviteCode}
      </button>
    </div>
  );
}
