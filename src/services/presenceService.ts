
import {
  ref,
  onValue,
  onDisconnect,
  push,
  set,
  remove,
  serverTimestamp,
} from "firebase/database";

import { database } from "./firebase";


export function trackPresence(userId: string) {
  console.log("TRACK PRESENCE CALLED");
  const connectedRef = ref(database, ".info/connected");

  const userConnectionsRef = ref(
    database,
    `presence/${userId}/connections`
  );

  const lastOnlineRef = ref(
    database,
    `presence/${userId}/lastOnline`
  );

  let isActive = true;
  let connectionAttempt = 0;

  const activeConnections = new Set<string>();

  const unsubscribe = onValue(connectedRef, async (snapshot) => {
    if (!isActive) return;

    // Handle disconnection
    if (snapshot.val() !== true) {
      connectionAttempt++;
      return;
    }

    const currentAttempt = ++connectionAttempt;

    const connectionRef = push(userConnectionsRef);
    const connectionId = connectionRef.key!;

    try {
      // Register automatic cleanup first
      await onDisconnect(connectionRef).remove();

      await onDisconnect(lastOnlineRef).set(serverTimestamp());

      // Ignore stale asynchronous attempts
      if (!isActive || currentAttempt !== connectionAttempt) {
        await onDisconnect(connectionRef).cancel();
        return;
      }

      // Mark this connection as active
      await set(connectionRef, true);

      if (!isActive || currentAttempt !== connectionAttempt) {
        await remove(connectionRef);
        await onDisconnect(connectionRef).cancel();
        return;
      }

      activeConnections.add(connectionId);

    } catch (error) {
      console.error("Presence tracking error:", error);
    }
  });

  // Explicit cleanup for logout
  const cleanup = async () => {
    console.log("PRESENCE CLEANUP CALLED");
    isActive = false;
    connectionAttempt++;

    unsubscribe();

    try {
      const cleanupPromises = [...activeConnections].map(
        async (connectionId) => {
          const connectionRef = ref(
            database,
            `presence/${userId}/connections/${connectionId}`
          );

          await onDisconnect(connectionRef).cancel();
          await remove(connectionRef);
        }
      );

      await Promise.all(cleanupPromises);

      await onDisconnect(lastOnlineRef).cancel();
      await set(lastOnlineRef, serverTimestamp());

      activeConnections.clear();

    } catch (error) {
      console.error("Presence cleanup error:", error);
      throw error;
    }
  };

  return {
    unsubscribe,
    cleanup,
  };
}




export type UserPresence = {
  isOnline: boolean;
  lastOnline: number | null;
};

export function subscribeToUserPresence(
  userId: string,
  callback: (presence: UserPresence) => void
) {
  const presenceRef = ref(database, `presence/${userId}`);

  const unsubscribe = onValue(presenceRef, (snapshot) => {
    const data = snapshot.val();

    const connections = data?.connections;

    const isOnline =
      connections !== undefined &&
      connections !== null &&
      Object.keys(connections).length > 0;

    callback({
      isOnline,
      lastOnline: data?.lastOnline ?? null,
    });
  });

  return unsubscribe;
}

