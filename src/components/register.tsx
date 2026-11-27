
import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  User,
  Mail,
  LockKeyhole,
} from "lucide-react";
import { WhatsAppLogo } from "./WhatsAppLogo";

import { auth } from "../services/firebase";
import { saveUserProfile, signInWithGoogle } from "../services/userService";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { PhoneAuthButton, PhoneAuthModal } from "./PhoneAuthModal";
import ThemeToggle from "./themeToggle";

function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [error, setError] = useState("");
  const isAnyLoading = loading || googleLoading;


const handleRegister = async (e: FormEvent) => {
  e.preventDefault();
  setError("");

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();

  // Name validation
  if (!trimmedName) {
    setError("Name cannot be empty or contain only spaces.");
    return;
  }

  if (trimmedName.length > 50) {
    setError("Name cannot exceed 50 characters.");
    return;
  }

  // Email validation
  if (!trimmedEmail) {
    setError("Email is required.");
    return;
  }

  // Password validation
  if (password.length < 8) {
    setError("Password must be at least 8 characters.");
    return;
  }

  if (
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    setError(
      "Password must contain uppercase, lowercase and a number."
    );
    return;
  }

  if (password !== confirmPassword) {
    setError("Passwords do not match.");
    return;
  }

  setLoading(true);

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      trimmedEmail,
      password
    );

    await updateProfile(userCredential.user, {
      displayName: trimmedName,
    });

    await saveUserProfile(userCredential.user);

    navigate("/dashboard");
  } catch (error: unknown) {
    let errorCode = "";

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error
    ) {
      errorCode = String(error.code);
    }

    if (errorCode === "auth/email-already-in-use") {
      setError("This email is already registered.");
    } else if (errorCode === "auth/weak-password") {
      setError("Password is too weak.");
    } else if (errorCode === "auth/invalid-email") {
      setError("Please enter a valid email address.");
    } else {
      setError("Something went wrong. Please try again.");
    }
  } finally {
    setLoading(false);
  }
};

const handleGoogleSignUp = async () => {
  if (isAnyLoading) return;
  setError("");
  setGoogleLoading(true);

  try {
    await signInWithGoogle();
    navigate("/dashboard");
  } catch (err: unknown) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? String(err.code)
        : "";
    if (code === "auth/popup-closed-by-user") {
      setError("Google sign-in was cancelled.");
    } else if (code === "auth/popup-blocked") {
      setError("Popup was blocked by your browser. Please allow popups.");
    } else {
      setError("Google sign-in failed. Please try again.");
    }
  } finally {
    setGoogleLoading(false);
  }
};


  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#111b21] text-gray-900 dark:text-gray-100 scheme-light dark:scheme-dark">
      <div className="fixed right-5 top-5 z-50">
        <ThemeToggle />
      </div>

      {/* Green Header */}
      <header className="h-52 bg-[#00a884]">
        <div className="max-w-6xl mx-auto px-6 pt-8">
          <div className="flex items-center gap-3 text-white">
            <WhatsAppLogo size={34} />
            <span className="text-2xl font-semibold tracking-wide">
              ChatSpace
            </span>
          </div>
        </div>
      </header>

      {/* Register Card */}
      <main className="max-w-5xl mx-auto px-4 -mt-24 pb-12">
        <div className="bg-white dark:bg-[#202c33] rounded-xl shadow-lg overflow-hidden grid md:grid-cols-2">

          {/* Left Panel */}
          <div className="hidden md:flex bg-[#f7f9fa] dark:bg-[#182229] flex-col justify-center items-center p-10 text-center border-r border-gray-100 dark:border-gray-700">
            <div className="w-36 h-36 rounded-full bg-[#d9fdd3] flex items-center justify-center mb-7">
              <WhatsAppLogo size={76} className="text-[#00a884]" />
            </div>

            <h1 className="text-3xl font-light text-gray-800 dark:text-gray-100 mb-4">
              Join ChatSpace
            </h1>

            <p className="text-gray-500 dark:text-gray-400 leading-7 max-w-xs">
              Create your account and start connecting with friends
              and people around you.
            </p>

            <div className="mt-8 flex items-center gap-2 text-sm text-[#00a884]">
              <LockKeyhole size={16} />
              <span>Your conversations, your space.</span>
            </div>
          </div>

          {/* Right Panel */}
          <div className="p-7 sm:p-10 md:p-12">
            <div className="mb-7">
              <p className="text-sm font-medium text-[#00a884] mb-2">
                GET STARTED
              </p>

              <h2 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
                Create Account
              </h2>

              <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                Fill in your details to get started.
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Full name
                </label>

                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-3 transition focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/15">
                  <User size={19} className="text-gray-400 dark:text-gray-500" />

                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    required
                    className="w-full py-3 px-3 outline-none text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-transparent"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email address
                </label>

                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-3 transition focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/15">
                  <Mail size={19} className="text-gray-400 dark:text-gray-500" />

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full py-3 px-3 outline-none text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-transparent"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>

                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-3 transition focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/15">
                  <LockKeyhole size={19} className="text-gray-400 dark:text-gray-500" />

                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    required
                    className="w-full py-3 px-3 outline-none text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-transparent"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-white"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm password
                </label>

                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-3 transition focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/15">
                  <LockKeyhole size={19} className="text-gray-400 dark:text-gray-500" />

                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                    className="w-full py-3 px-3 outline-none text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-transparent"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-white"
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              {/* Register Button */}
              <button
                type="submit"
                disabled={isAnyLoading}
                className="w-full bg-[#00a884] hover:bg-[#008f72] text-white font-semibold py-3 rounded-lg transition duration-200 hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <GoogleAuthButton
              onClick={handleGoogleSignUp}
              disabled={isAnyLoading}
              label={googleLoading ? "Connecting to Google..." : "Continue with Google"}
            />

            <PhoneAuthButton
              onClick={() => setIsPhoneModalOpen(true)}
              disabled={isAnyLoading}
            />

            <div className="mt-7 text-center text-sm text-gray-500 dark:text-gray-400">
              Already have an account?{" "}
              <Link
                to="/"
                className="text-[#00a884] font-semibold hover:text-[#008f72] hover:underline"
              >
                Login
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-7">
          ChatSpace · Stay connected with the people who matter.
        </p>
      </main>

      <PhoneAuthModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        onSuccess={() => navigate("/dashboard")}
      />
    </div>
  );
}

export default Register;
