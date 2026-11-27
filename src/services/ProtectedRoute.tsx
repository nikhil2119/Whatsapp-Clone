import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { WhatsAppLogo } from "../components/WhatsAppLogo";

function AuthLoadingScreen() {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center bg-[#f0f2f5] dark:bg-[#111b21] px-6 text-center">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#00a884]/15 text-[#00a884]">
        <WhatsAppLogo size={36} />
      </div>

      <h1 className="m-0 text-lg font-medium text-[#111b21] dark:text-[#e9edef]">
        WhatsApp
      </h1>

      <div className="mt-4 h-1 w-44 overflow-hidden rounded-full bg-[#dfe3e5] dark:bg-[#202c33]">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-[#00a884]" />
      </div>

      <p className="mt-4 text-xs text-[#667781] dark:text-[#8696a0]">
        🔒 End-to-end encrypted
      </p>
    </div>
  );
}

function RestrictToLoggedinUserOnly() {
  const { user, loading } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    console.log("User is not authenticated. Redirecting to login page.");
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function RestrictLoggedInUsers() {
  const { user, loading } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export { RestrictLoggedInUsers, RestrictToLoggedinUserOnly };
