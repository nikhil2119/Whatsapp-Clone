import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Phone, X, ArrowLeft } from "lucide-react";
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { sendPhoneOtp, verifyPhoneOtp } from "../services/userService";

type PhoneAuthButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export function PhoneAuthButton({
  onClick,
  disabled = false,
}: PhoneAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#2a3942] py-2.5 px-4 text-sm font-medium text-gray-700 dark:text-gray-100 transition hover:bg-gray-50 dark:hover:bg-[#374650] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Phone size={17} className="text-[#00a884]" />
      <span>Continue with Phone</span>
    </button>
  );
}

type PhoneAuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function PhoneAuthModal({
  isOpen,
  onClose,
  onSuccess,
}: PhoneAuthModalProps) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phoneNumber, setPhoneNumber] = useState("+91");
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const clearVerifier = () => {
    if (verifierRef.current) {
      try {
        verifierRef.current.clear();
      } catch {
        // Ignore if already cleared
      }
      verifierRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      clearVerifier();
      confirmationRef.current = null;
      setStep("phone");
      setPhoneNumber("+91");
      setDisplayName("");
      setOtp("");
      setError("");
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => clearVerifier();
  }, []);

  if (!isOpen) return null;

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    const formatted = phoneNumber.replace(/\s+/g, "").trim();
    if (!/^\+[1-9]\d{6,14}$/.test(formatted)) {
      setError("Enter a valid phone number with country code (e.g. +919876543210).");
      return;
    }

    if (!recaptchaContainerRef.current) return;

    setLoading(true);
    clearVerifier();
    recaptchaContainerRef.current.innerHTML = "";
    const recaptchaMount = document.createElement("div");
    recaptchaContainerRef.current.appendChild(recaptchaMount);

    try {
      const { confirmationResult, verifier } = await sendPhoneOtp(
        formatted,
        recaptchaMount
      );
      verifierRef.current = verifier;
      confirmationRef.current = confirmationResult;
      setStep("otp");
    } catch (err: unknown) {
      console.error("Send OTP error:", err);
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String(err.code)
          : "";
      if (code === "auth/invalid-phone-number") {
        setError("Invalid phone number format.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many requests. Please try again later.");
      } else if (code === "auth/quota-exceeded") {
        setError("Daily SMS quota exceeded. Use a test phone number or try tomorrow.");
      } else if (code === "auth/billing-not-enabled") {
        setError("Real SMS requires Blaze plan. Use a Firebase Test Phone Number for free testing.");
      } else if (code === "auth/operation-not-allowed") {
        setError("Phone auth or this country's SMS region is disabled in Firebase Console.");
      } else if (code === "auth/unauthorized-domain") {
        setError("This domain is not authorized in Firebase Console → Authentication → Settings.");
      } else {
        setError(`Failed to send OTP${code ? ` (${code})` : ""}. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || !confirmationRef.current) return;
    setError("");

    const trimmedOtp = otp.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      await verifyPhoneOtp(confirmationRef.current, trimmedOtp, displayName);
      onClose();
      onSuccess();
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String(err.code)
          : "";
      if (code === "auth/invalid-verification-code") {
        setError("Incorrect OTP. Please try again.");
      } else if (code === "auth/code-expired") {
        setError("OTP expired. Please request a new code.");
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-white dark:bg-[#202c33] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4">
          <div className="flex items-center gap-2.5">
            {step === "otp" && (
              <button
                type="button"
                onClick={() => {
                  clearVerifier();
                  setStep("phone");
                  setOtp("");
                  setError("");
                }}
                aria-label="Back"
                className="grid h-7 w-7 cursor-pointer place-items-center rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#374650]"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <Phone size={18} className="text-[#00a884]" />
            <h2 className="m-0 text-base font-semibold text-gray-800 dark:text-gray-100">
              {step === "phone" ? "Phone Sign-In" : "Verify OTP"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#374650]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {step === "phone" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  Phone Number (with country code)
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+919876543210"
                  required
                  className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/15"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  Your Name (for new users, optional)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={50}
                  className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/15"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="h-10 w-full cursor-pointer rounded-lg border-0 bg-[#00a884] text-sm font-semibold text-white transition hover:bg-[#008f72] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Sending OTP..." : "Send OTP"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="m-0 text-xs text-gray-500 dark:text-gray-300">
                Enter the 6-digit code sent to{" "}
                <span className="font-semibold text-gray-800 dark:text-white">
                  {phoneNumber}
                </span>
              </p>

              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                required
                className="h-11 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 text-center font-mono text-lg tracking-[0.35em] text-gray-900 dark:text-gray-100 outline-none focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/15"
              />

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="h-10 w-full cursor-pointer rounded-lg border-0 bg-[#00a884] text-sm font-semibold text-white transition hover:bg-[#008f72] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Verifying..." : "Verify & Continue"}
              </button>
            </form>
          )}

          {/* Invisible reCAPTCHA anchor */}
          <div ref={recaptchaContainerRef} />
        </div>
      </div>
    </div>
  );
}
