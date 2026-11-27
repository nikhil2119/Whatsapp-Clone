import {
  onValue,
  push,
  ref,
  set,
  update,
} from "firebase/database";
import { database } from "./firebase";

export type CallStatus = "ringing" | "accepted" | "rejected" | "ended";

export type CallSession = {
  id: string;
  channelName: string;
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  status: CallStatus;
  createdAt: number;
};

const CALL_RING_TIMEOUT_MS = 60_000;

export async function startCall(
  callerId: string,
  callerName: string,
  calleeId: string,
  calleeName: string
): Promise<CallSession> {
  const callsRef = ref(database, "calls");
  const newCallRef = push(callsRef);
  const callId = newCallRef.key!;
  const fixedChannel = import.meta.env.VITE_AGORA_CHANNEL?.trim();

  const session: Omit<CallSession, "id"> = {
    channelName: fixedChannel || callId,
    callerId,
    callerName,
    calleeId,
    calleeName,
    status: "ringing",
    createdAt: Date.now(),
  };

  await set(newCallRef, session);

  return { id: callId, ...session };
}

export async function updateCallStatus(
  callId: string,
  status: CallStatus
): Promise<void> {
  const callRef = ref(database, `calls/${callId}`);
  await update(callRef, { status });
}

export function subscribeToCall(
  callId: string,
  callback: (call: CallSession | null) => void
) {
  const callRef = ref(database, `calls/${callId}`);

  const unsubscribe = onValue(callRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      callback(null);
      return;
    }
    callback({ id: callId, ...(data as Omit<CallSession, "id">) });
  });

  return unsubscribe;
}

export function subscribeToIncomingCalls(
  userId: string,
  callback: (incomingCall: CallSession | null) => void
) {
  const callsRef = ref(database, "calls");

  const unsubscribe = onValue(callsRef, (snapshot) => {
    const data = snapshot.val() as Record<string, Omit<CallSession, "id">> | null;
    if (!data) {
      callback(null);
      return;
    }

    const now = Date.now();
    const ringingCalls = Object.entries(data)
      .map(([id, call]) => ({ id, ...call }))
      .filter(
        (call) =>
          call.calleeId === userId &&
          call.status === "ringing" &&
          now - call.createdAt < CALL_RING_TIMEOUT_MS
      )
      .sort((a, b) => b.createdAt - a.createdAt);

    callback(ringingCalls[0] ?? null);
  });

  return unsubscribe;
}
