"use client";

import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { playActionSound } from "@/components/sound";

type AppNotification = {
  _id: string;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: string;
};

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const fetchNotifications = async () => {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) {
      return;
    }

    const data = await res.json();
    setUnread(data.unread ?? 0);
    setNotifications(data.notifications ?? []);
    return data.unread ?? 0;
  };

  useEffect(() => {
    let previous = 0;
    const tick = async () => {
      const currentUnread = await fetchNotifications();
      if (typeof currentUnread === "number" && currentUnread > previous) {
        playActionSound("notification");
      }

      previous = currentUnread ?? 0;
    };

    void tick();
    const interval = setInterval(tick, 12000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const markAsRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchNotifications();
  };

  const markAll = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    await fetchNotifications();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={async () => {
          const next = !open;
          setOpen(next);
          if (next) {
            await fetchNotifications();
          }
        }}
        className="relative rounded-xl border border-slate-700 bg-slate-900/70 p-2 hover:bg-slate-800"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute -right-2 -top-2 rounded-full bg-cyan-500 px-1.5 text-xs font-bold text-black">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[340px] rounded-2xl border border-slate-700 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">Notifications</p>
            <button
              type="button"
              onClick={() => void markAll()}
              className="text-xs text-cyan-300 hover:text-cyan-200"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-400">
                No notifications yet.
              </p>
            ) : (
              notifications.map((item) => (
                <div
                  key={item._id}
                  className={`rounded-xl border px-3 py-2 ${
                    item.read ? "border-slate-800 bg-slate-900/40" : "border-cyan-500/40 bg-cyan-500/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{item.title}</p>
                      {item.body ? <p className="mt-0.5 text-xs text-slate-300">{item.body}</p> : null}
                      <p className="mt-1 text-[11px] text-slate-500">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </p>
                    </div>

                    {!item.read ? (
                      <button
                        type="button"
                        onClick={() => void markAsRead(item._id)}
                        className="text-[11px] text-cyan-300 hover:text-cyan-200"
                      >
                        Read
                      </button>
                    ) : null}
                  </div>

                  {item.link ? (
                    <Link
                      href={item.link}
                      onClick={() => {
                        void markAsRead(item._id);
                        setOpen(false);
                      }}
                      className="mt-2 inline-block text-xs text-cyan-300 hover:text-cyan-200"
                    >
                      Open
                    </Link>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
