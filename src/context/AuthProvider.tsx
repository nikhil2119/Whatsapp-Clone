
import { useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";

import { auth } from "../services/firebase";
import { AuthContext } from "./AuthContext";
import { trackPresence } from "../services/presenceService";

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const presenceControllerRef = useRef<
    ReturnType<typeof trackPresence> | null
  >(null);

  // Authentication state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Presence tracking
  useEffect(() => {
    if (!user?.uid) return;

    const presenceController = trackPresence(user.uid);
    presenceControllerRef.current = presenceController;

    return () => {
      if (presenceControllerRef.current === presenceController) {
        presenceControllerRef.current = null;

        void presenceController.cleanup().catch((error) => {
          console.error("Presence cleanup failed:", error);
        });
      }
    };
  }, [user?.uid]);

  // Centralized logout
  const logout = async () => {
    const presenceController = presenceControllerRef.current;

    if (presenceController) {
      await presenceController.cleanup();
      presenceControllerRef.current = null;
    }

    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
