"use client";

import { LogOut, ShieldCheck, UserCircle2 } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";

import MessageCounter from "@/components/message-counter";
import NotificationBell from "@/components/notification-bell";

type NavProps = {
  fullName: string;
  isAdmin?: boolean;
};

export default function TopNav({ fullName, isAdmin = false }: NavProps) {
  console.log("[TOP-NAV] Rendering TopNav - isAdmin prop:", isAdmin, "fullName:", fullName);
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="rounded-md transition hover:opacity-90">
          <p className="font-display text-xl font-bold tracking-wide">SoulSync</p>
          <p className="text-xs text-slate-400">Hi, {fullName}</p>
        </Link>

        <nav className="flex items-center gap-2">
          {isAdmin ? (
            <Link href="/admin" className="nav-item">
              <ShieldCheck className="h-4 w-4" />
              Admin
            </Link>
          ) : null}
          <MessageCounter />
          <Link href="/profile" className="nav-item">
            <UserCircle2 className="h-4 w-4" />
            Profile
          </Link>
          <NotificationBell />
          <button
            className="nav-item"
            onClick={() => signOut({ callbackUrl: "/" })}
            type="button"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
