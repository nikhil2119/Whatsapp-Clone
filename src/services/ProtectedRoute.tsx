import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function RestrictToLoggedinUserOnly() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p>Loading...</p>;
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
    return <p>Loading...</p>;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export { RestrictLoggedInUsers, RestrictToLoggedinUserOnly };
