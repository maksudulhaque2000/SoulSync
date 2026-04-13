"use client";

import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = (await res.json().catch(() => ({}))) as { message?: string };
      toast.success(data.message ?? "If your email exists, a reset link has been sent.");
      setEmail("");
    } catch {
      toast.error("Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-svh bg-site-gradient px-4 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-700/60 bg-slate-900/60 p-6 backdrop-blur-xl md:p-8">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">SoulSync Security</p>
        <h1 className="mt-3 font-display text-3xl font-bold leading-tight">Forgot your password?</h1>
        <p className="mt-3 text-sm text-slate-300">
          Enter your account email and we will send a secure reset link.
        </p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="auth-input"
          />
          <button disabled={loading} type="submit" className="auth-button w-full">
            {loading ? "Sending link..." : "Send reset link"}
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-400">
          Remembered your password?{" "}
          <Link href="/" className="font-semibold text-cyan-300 hover:text-cyan-200">
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}
