
import { useState, type FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import {
  MessageCircle,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react";

import { auth } from "../services/firebase";
import ThemeToggle from "./themeToggle";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


const handleLogin = async (e: FormEvent) => {
  e.preventDefault();
  setError("");

  // Prevent multiple submissions
  if (loading) return;

  const trimmedEmail = email.trim();

  // Validate email
  if (!trimmedEmail) {
    setError("Email is required.");
    return;
  }

  // Validate password
  if (!password) {
    setError("Password is required.");
    return;
  }

  setLoading(true);

  try {
    await signInWithEmailAndPassword(
      auth,
      trimmedEmail,
      password
    );

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

    if (
      errorCode === "auth/invalid-credential" ||
      errorCode === "auth/user-not-found" ||
      errorCode === "auth/wrong-password"
    ) {
      setError("Incorrect email or password.");
    } else if (errorCode === "auth/invalid-email") {
      setError("Please enter a valid email address.");
    } else if (errorCode === "auth/too-many-requests") {
      setError("Too many attempts. Please try again later.");
    } else if (errorCode === "auth/user-disabled") {
      setError("This account has been disabled.");
    } else {
      setError("Something went wrong. Please try again.");
    }
  } finally {
    setLoading(false);
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
            <MessageCircle size={34} />
            <span className="text-2xl font-semibold tracking-wide">
              ChatSpace
            </span>
          </div>
        </div>
      </header>

      {/* Login Card */}
      <main className="max-w-5xl mx-auto px-4 -mt-24 pb-12">
        <div className="bg-white dark:bg-[#202c33] rounded-xl shadow-lg overflow-hidden grid md:grid-cols-2">

          {/* Left Panel */}
          <div className="hidden md:flex bg-[#f7f9fa] dark:bg-[#182229] flex-col justify-center items-center p-10 text-center border-r border-gray-100 dark:border-gray-700">
            <div className="w-36 h-36 rounded-full bg-[#d9fdd3] flex items-center justify-center mb-7">
              <MessageCircle size={76} className="text-[#00a884]" />
            </div>

            <h1 className="text-3xl font-light text-gray-800 dark:text-gray-100 mb-4">
              Welcome back!
            </h1>

            <p className="text-gray-500 dark:text-gray-400 leading-7 max-w-xs">
              Connect with your friends and continue your conversations
              with ChatSpace.
            </p>

            <div className="mt-8 flex items-center gap-2 text-sm text-[#007f68]">
              <LockKeyhole size={16} />
              <span>Simple. Secure. Connected.</span>
            </div>
          </div>

          {/* Right Panel */}
          <div className="p-7 sm:p-10 md:p-12">
            <div className="mb-8">
              <p className="text-sm font-medium text-[#007f68] mb-2">
                WELCOME BACK
              </p>

              <h2 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
                Login to ChatSpace
              </h2>

              <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                Enter your details to continue.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email address
                </label>

                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-3 transition focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/15">
                  <Mail size={19} className="text-gray-500 dark:text-gray-400" />

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full py-3 px-3 outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 bg-transparent"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>

                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-3 transition focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/15">
                  <LockKeyhole size={19} className="text-gray-500 dark:text-gray-400" />

                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full py-3 px-3 outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 bg-transparent"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#007f68] hover:bg-[#006b58] text-white font-semibold py-3 rounded-lg transition duration-200 hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Logging in..." : "Login"}
              </button>

            </form>

            <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-300">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="text-[#007f68] font-semibold hover:text-[#006b58] hover:underline"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 dark:text-gray-400 mt-7">
          ChatSpace · Stay connected with the people who matter.
        </p>
      </main>
    </div>
  );
}

export default Login;
