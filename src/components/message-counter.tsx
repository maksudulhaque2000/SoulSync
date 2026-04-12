"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function MessageCounter() {
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await fetch("/api/conversations", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setTotalUnread(data.totalUnread ?? 0);
      } catch (err) {
        console.error("[MESSAGE-COUNTER] Error:", err);
      }
    };

    void fetchUnreadCount();
    const interval = setInterval(() => {
      void fetchUnreadCount();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Link href="/messages" className="relative nav-item">
      <MessageCircle className="h-4 w-4" />
      Messages
      {totalUnread > 0 && (
        <span className="absolute -right-2 -top-2 rounded-full bg-cyan-500 px-1.5 text-xs font-bold text-black">
          {totalUnread > 99 ? "99+" : totalUnread}
        </span>
      )}
    </Link>
  );
}
