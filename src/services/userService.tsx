import { get, onValue, ref, set } from "firebase/database";
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  updateProfile,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { auth, database } from "./firebase";

export type UserProfile = {
  uid: string;
  username: string;
  email: string;
  createdAt: number;
};


export async function saveUserProfile(user: User, customName?: string) {
  const userRef = ref(database, `users/${user.uid}`);
  const fallbackName =
    user.phoneNumber || user.email?.split("@")[0] || "User";
  const username = (
    customName?.trim() ||
    user.displayName ||
    fallbackName
  ).slice(0, 50);

  await set(userRef, {
    username,
    email: user.email || "",
    createdAt: Date.now(),
  });
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const result = await signInWithPopup(auth, provider);
  const userRef = ref(database, `users/${result.user.uid}`);
  const snapshot = await get(userRef);

  if (!snapshot.exists()) {
    await saveUserProfile(result.user);
  }

  return result.user;
}

export async function sendPhoneOtp(
  phoneNumber: string,
  recaptchaContainer: HTMLElement
): Promise<{
  confirmationResult: ConfirmationResult;
  verifier: RecaptchaVerifier;
}> {
  const verifier = new RecaptchaVerifier(auth, recaptchaContainer, {
    size: "invisible",
  });

  try {
    const confirmationResult = await signInWithPhoneNumber(
      auth,
      phoneNumber,
      verifier
    );
    return { confirmationResult, verifier };
  } catch (error) {
    verifier.clear();
    throw error;
  }
}

export async function verifyPhoneOtp(
  confirmationResult: ConfirmationResult,
  otp: string,
  displayName?: string
): Promise<User> {
  const result = await confirmationResult.confirm(otp);
  const trimmedName = displayName?.trim();

  if (trimmedName && !result.user.displayName) {
    await updateProfile(result.user, { displayName: trimmedName });
  }

  const userRef = ref(database, `users/${result.user.uid}`);
  const snapshot = await get(userRef);

  if (!snapshot.exists()) {
    await saveUserProfile(result.user, trimmedName);
  }

  return result.user;
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