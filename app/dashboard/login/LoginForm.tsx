"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const text = await res.text();
      let data: { error?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (res.ok) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        setError(data.error || `Sign in failed (${res.status})`);
        setLoading(false);
      }
    } catch (err) {
      setError((err as Error).message || "Couldn't reach the server. Try again in a moment.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <label className="label">Password</label>
        <input
          type="password"
          name="password"
          className="input"
          placeholder="Password"
          required
          autoFocus
        />
      </div>
      {error && <div className="mb-4 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}
      <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
