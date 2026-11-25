import { onValue, ref, set } from "firebase/database";
import { database } from "./firebase";
import type { User } from "firebase/auth";

export type UserProfile = {
  uid: string;
  username: string;
  email: string;
  createdAt: number;
};


export async function saveUserProfile(user: User) {
  const userRef = ref(database, `users/${user.uid}`);

  await set(userRef, {
    username: user.displayName || "",
    email: user.email || "",
    createdAt: Date.now(),
  });
}


export function subscribeToUsers(
  callback: (users: UserProfile[]) => void
) {
  const usersRef = ref(database, "users");

  const unsubscribe = onValue(usersRef, (snapshot) => {
    const data = snapshot.val();

    if (!data) {
      callback([]);
      return;
    }

    const users: UserProfile[] = Object.entries(data).map(
      ([uid, profile]) => ({
        uid,
        ...(profile as Omit<UserProfile, "uid">),
      })
    );

    callback(users);
  });

  return unsubscribe;
}