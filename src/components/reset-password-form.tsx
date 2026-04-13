"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

type ResetPasswordFormProps = {
  initialEmail: string;
  initialToken: string;
};

export default function ResetPasswordForm({ initialEmail, initialToken }: ResetPasswordFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const hasLinkData = Boolean(initialEmail && initialToken);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token,
          password,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        toast.error(data.error ?? "Unable to reset password");
        return;
      }

      toast.success("Password updated. Please sign in.");
      router.push("/");
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
        <h1 className="mt-3 font-display text-3xl font-bold leading-tight">Reset Password</h1>
        <p className="mt-3 text-sm text-slate-300">
          Set your new password using the link sent to your email.
        </p>

        {!hasLinkData && (
          <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            No reset link data found. Paste your token and email manually or request a new link.
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Account email"
            className="auth-input"
          />
          <input
            type="text"
            required
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Reset token"
            className="auth-input"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              className="auth-input pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-400 transition hover:text-cyan-300"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              className="auth-input pr-12"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-400 transition hover:text-cyan-300"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button disabled={loading} type="submit" className="auth-button w-full">
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-400">
          Need a new reset link?{" "}
          <Link href="/forgot-password" className="font-semibold text-cyan-300 hover:text-cyan-200">
            Request again
          </Link>
        </p>
      </div>
    </main>
  );
}
