import Login from "./components/login";
import Register from "./components/register";
import Dashboard from "./components/dashboard";
import { Routes, Route} from "react-router-dom";
import {RestrictToLoggedinUserOnly, RestrictLoggedInUsers} from "./services/ProtectedRoute";
import { AuthProvider } from "./context/AuthProvider";

import { ThemeProvider } from "./context/ThemeProvider";


function App() {
  return (
    // add theme provider here
    <ThemeProvider>
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
    </ThemeProvider>
  );
}

export default App;
