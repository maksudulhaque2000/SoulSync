"use client";

import { Check, CheckCircle2, MessageCircle, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";

import { playActionSound } from "@/components/sound";

type ConnectionState = "none" | "pending-sent" | "pending-received" | "connected";

type Props = {
  targetUserId: string;
  isConnected: boolean;
  hasPendingSent: boolean;
  hasPendingReceived: boolean;
};

function getInitialConnectionState({ isConnected, hasPendingSent, hasPendingReceived }: Omit<Props, "targetUserId">): ConnectionState {
  if (isConnected) return "connected";
  if (hasPendingSent) return "pending-sent";
  if (hasPendingReceived) return "pending-received";
  return "none";
}

export default function PublicProfileActions(props: Props) {
  const [state, setState] = useState<ConnectionState>(() => getInitialConnectionState(props));
  const [sending, setSending] = useState(false);
  const [processingIncoming, setProcessingIncoming] = useState(false);

  const sendConnection = async () => {
    if (state !== "none") return;

    setSending(true);
    const res = await fetch("/api/connection/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: props.targetUserId }),
    });
    setSending(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Connection request failed");
      return;
    }

    setState("pending-sent");
    toast.success("Connection request sent");
    playActionSound("notification");
  };

  const acceptIncomingRequest = async () => {
    if (state !== "pending-received") return;

    setProcessingIncoming(true);
    const res = await fetch("/api/connection/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterId: props.targetUserId }),
    });
    setProcessingIncoming(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not accept request");
      return;
    }

    setState("connected");
    toast.success("Connection accepted");
    playActionSound("notification");
  };

  const rejectIncomingRequest = async () => {
    if (state !== "pending-received") return;

    setProcessingIncoming(true);
    const res = await fetch("/api/connection/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterId: props.targetUserId }),
    });
    setProcessingIncoming(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not reject request");
      return;
    }

    setState("none");
    toast.success("Connection request rejected");
    playActionSound("notification");
  };

  const connectionLabel =
    state === "connected"
      ? "Connected"
      : state === "pending-sent"
        ? "Request Sent"
        : state === "pending-received"
          ? "Requested You"
          : sending
            ? "Sending..."
            : "Request Connection";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Link
        href={`/messages?userId=${props.targetUserId}`}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
      >
        <MessageCircle className="h-4 w-4" />
        Message
      </Link>

      {state === "pending-received" ? (
        <>
          <button
            type="button"
            onClick={() => void acceptIncomingRequest()}
            disabled={processingIncoming}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/50 px-3 py-2 text-sm text-emerald-200 transition hover:bg-emerald-700/15 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Check className="h-4 w-4" />
            Accept
          </button>
          <button
            type="button"
            onClick={() => void rejectIncomingRequest()}
            disabled={processingIncoming}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/50 px-3 py-2 text-sm text-rose-200 transition hover:bg-rose-700/15 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <X className="h-4 w-4" />
            Reject
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => void sendConnection()}
          disabled={state !== "none" || sending}
          className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/50 px-3 py-2 text-sm text-cyan-200 transition hover:bg-cyan-600/10 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {state === "connected" ? <CheckCircle2 className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {connectionLabel}
        </button>
      )}
    </div>
  );
}