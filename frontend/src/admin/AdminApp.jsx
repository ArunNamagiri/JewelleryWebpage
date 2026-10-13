import React, { useEffect, useState } from "react";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const TOKEN_KEY = "ai_jewellery_admin_token";

export default function AdminApp() {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || "");
  const [username, setUsername] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (!token) {
      setCheckingSession(false);
      return;
    }

    fetch(`${API_URL}/api/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (data.success) {
          setUsername(data.username);
        } else {
          throw new Error("invalid session");
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
      })
      .finally(() => setCheckingSession(false));
  }, [token]);

  const handleLoginSuccess = (newToken, name) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUsername(name);
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUsername("");
  };

  const shellStyle = {
    fontFamily: "Inter, system-ui, sans-serif",
    backgroundColor: "#fcf8f2",
    minHeight: "100vh",
  };

  if (checkingSession) {
    return (
      <div style={{ ...shellStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading admin panel...
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      {!token ? (
        <AdminLogin apiUrl={API_URL} onSuccess={handleLoginSuccess} />
      ) : (
        <AdminDashboard apiUrl={API_URL} token={token} username={username} onLogout={handleLogout} />
      )}
    </div>
  );
}
