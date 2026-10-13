import React, { useState } from "react";

export default function AdminLogin({ apiUrl, onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || "Login failed");
      }

      onSuccess(data.token, data.username);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          width: "100%",
          maxWidth: "380px",
          padding: "40px",
          borderRadius: "12px",
          border: "1px solid #f0eae1",
          boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
        }}
      >
        <h1
          style={{
            fontFamily: "serif",
            fontWeight: "normal",
            fontSize: "1.5rem",
            color: "#112217",
            margin: "0 0 4px",
          }}
        >
          Owner Login
        </h1>
        <p style={{ color: "#888", fontSize: "0.8rem", margin: "0 0 24px" }}>
          Manage products, photos & silver rate
        </p>

        <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "#444", marginBottom: "6px" }}>
          USERNAME
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: "6px",
            border: "1px solid #dcd6cd",
            marginBottom: "16px",
          }}
        />

        <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "#444", marginBottom: "6px" }}>
          PASSWORD
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: "6px",
            border: "1px solid #dcd6cd",
            marginBottom: "20px",
          }}
        />

        {error && (
          <div style={{ color: "#c53030", fontSize: "0.8rem", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "13px",
            background: "#112217",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
