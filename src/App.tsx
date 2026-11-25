import Login from "./components/login";
import Register from "./components/register";
import Dashboard from "./components/dashboard";
import { Routes, Route} from "react-router-dom";
import {RestrictToLoggedinUserOnly, RestrictLoggedInUsers} from "./services/ProtectedRoute";
import { AuthProvider } from "./context/AuthProvider";

function App() {
  return (
    // add auth provider here
    <AuthProvider>
      <Routes>
        <Route element={<RestrictLoggedInUsers />}>
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Register />} />
        </Route>
        
        <Route element={<RestrictToLoggedinUserOnly />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
