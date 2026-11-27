import { useEffect, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import type { CallSession } from "../services/callService";

type VoiceCallModalProps = {
  call: CallSession | null;
  currentUserId: string;
  isMuted: boolean;
  errorMessage?: string;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
};

function formatDuration(seconds: number): string {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export function VoiceCallModal({
  call,
  currentUserId,
  isMuted,
  errorMessage,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
}: VoiceCallModalProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!call || call.status !== "accepted") {
      setElapsedSeconds(0);
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [call?.id, call?.status]);

  if (!call) return null;

  const isIncoming = call.calleeId === currentUserId;
  const peerName = isIncoming ? call.callerName : call.calleeName;

  const statusText =
    errorMessage ||
    (call.status === "ringing"
      ? isIncoming
        ? "Incoming voice call..."
        : "Calling..."
      : call.status === "accepted"
        ? formatDuration(elapsedSeconds)
        : call.status === "rejected"
          ? "Call declined"
          : "Call ended");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex w-full max-w-xs flex-col items-center rounded-2xl bg-[#111b21] px-6 py-8 text-center text-white shadow-2xl border border-[#303d45]">
        {/* Peer Avatar */}
        <div
          className={`mb-4 grid h-20 w-20 place-items-center rounded-full bg-[#00a884]/20 text-3xl font-semibold text-[#00a884] ${
            call.status === "ringing" ? "animate-pulse ring-4 ring-[#00a884]/30" : ""
          }`}
        >
          {peerName.charAt(0).toUpperCase() || "U"}
        </div>

        <h3 className="m-0 text-xl font-semibold text-[#e9edef]">
          {peerName}
        </h3>

        <p
          className={`mt-1.5 text-sm ${
            errorMessage ? "text-red-400" : "text-[#aebac1]"
          }`}
        >
          {statusText}
        </p>

        {/* Controls */}
        <div className="mt-8 flex items-center justify-center gap-6">
          {isIncoming && call.status === "ringing" ? (
            <>
              <button
                type="button"
                onClick={onReject}
                aria-label="Decline call"
                title="Decline"
                className="grid h-14 w-14 cursor-pointer place-items-center rounded-full border-0 bg-red-500 text-white shadow-lg transition hover:bg-red-600"
              >
                <PhoneOff size={24} />
              </button>

              <button
                type="button"
                onClick={onAccept}
                aria-label="Accept call"
                title="Accept"
                className="grid h-14 w-14 cursor-pointer place-items-center rounded-full border-0 bg-[#00a884] text-white shadow-lg transition hover:bg-[#008f72]"
              >
                <Phone size={24} />
              </button>
            </>
          ) : (
            <>
              {call.status === "accepted" && (
                <button
                  type="button"
                  onClick={onToggleMute}
                  aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                  title={isMuted ? "Unmute" : "Mute"}
                  className={`grid h-12 w-12 cursor-pointer place-items-center rounded-full border-0 transition ${
                    isMuted
                      ? "bg-white text-[#111b21]"
                      : "bg-[#2a3942] text-white hover:bg-[#374650]"
                  }`}
                >
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
              )}

              <button
                type="button"
                onClick={onEnd}
                aria-label="End call"
                title="End call"
                className="grid h-14 w-14 cursor-pointer place-items-center rounded-full border-0 bg-red-500 text-white shadow-lg transition hover:bg-red-600"
              >
                <PhoneOff size={24} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
