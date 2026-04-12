"use client";

import { formatDistanceToNow } from "date-fns";
import { Mic, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import { playActionSound } from "@/components/sound";

type Contact = {
  _id: string;
  firstName: string;
  lastName: string;
};

type Message = {
  _id: string;
  from: { _id: string; firstName: string; lastName: string };
  to: { _id: string; firstName: string; lastName: string };
  text?: string;
  voiceUrl?: string;
  createdAt: string;
};

type ConversationData = {
  userId: string;
  firstName: string;
  lastName: string;
  unreadCount: number;
};

type Props = {
  currentUserId: string;
  contacts: Contact[];
  initialSelectedId?: string;
};

export default function MessagesClient({ currentUserId, contacts, initialSelectedId }: Props) {
  const [manualSelectedId, setManualSelectedId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const selectedId = useMemo(() => {
    if (manualSelectedId && contacts.some((contact) => contact._id === manualSelectedId)) {
      return manualSelectedId;
    }
    if (initialSelectedId && contacts.some((contact) => contact._id === initialSelectedId)) {
      return initialSelectedId;
    }
    return contacts[0]?._id ?? "";
  }, [contacts, initialSelectedId, manualSelectedId]);

  const selectedUser = useMemo(() => contacts.find((c) => c._id === selectedId), [contacts, selectedId]);

  const getUnreadCount = (userId: string): number => {
    return conversations.find((c) => c.userId === userId)?.unreadCount ?? 0;
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch (err) {
      console.error("[MESSAGES] Fetch conversations error:", err);
    }
  };

  const loadConversation = async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/messages?userId=${selectedId}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages ?? []);
    await fetchConversations();
  };

  useEffect(() => {
    if (!selectedId) return;

    let active = true;

    const fetchConversation = async () => {
      const res = await fetch(`/api/messages?userId=${selectedId}`, { cache: "no-store" });
      if (!res.ok || !active) return;
      const data = await res.json();
      if (active) {
        setMessages(data.messages ?? []);
      }
    };

    queueMicrotask(() => {
      void fetchConversation();
    });

    const interval = setInterval(() => {
      void fetchConversation();
    }, 7000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedId]);

  useEffect(() => {
    void fetchConversations();
    const interval = setInterval(() => {
      void fetchConversations();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const sendText = async () => {
    if (!selectedId || !draft.trim()) return;

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: selectedId, text: draft }),
    });

    if (!res.ok) {
      toast.error("Message send failed");
      return;
    }

    setDraft("");
    await loadConversation();
    playActionSound("message");
  };

  const uploadVoice = async (blob: Blob) => {
    const body = new FormData();
    body.append("file", new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" }));

    const upload = await fetch("/api/upload", { method: "POST", body });
    if (!upload.ok) throw new Error("Voice upload failed");

    const data = await upload.json();

    const send = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: selectedId, voiceUrl: data.url }),
    });

    if (!send.ok) throw new Error("Voice send failed");
  };

  const toggleRecording = async () => {
    if (!recording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        audioChunks.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          const blob = new Blob(audioChunks.current, { type: "audio/webm" });
          try {
            await uploadVoice(blob);
            toast.success("Voice message sent");
            playActionSound("message");
            await loadConversation();
          } catch {
            toast.error("Voice message failed");
          }
        };

        recorder.start();
        setRecording(true);
      } catch {
        toast.error("Microphone permission denied");
      }

      return;
    }

    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRecording(false);
  };

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 py-6 lg:grid-cols-[0.7fr_1.3fr]">
      <aside className="card-panel">
        <h2 className="font-display text-2xl">Conversations</h2>
        <div className="mt-3 space-y-2">
          {contacts.map((contact) => {
            const unreadCount = getUnreadCount(contact._id);
            return (
              <button
                key={contact._id}
                className={`relative w-full rounded-xl border px-3 py-2 text-left transition ${selectedId === contact._id ? "border-cyan-500 bg-cyan-500/10 text-cyan-100" : "border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-800"}`}
                type="button"
                onClick={() => setManualSelectedId(contact._id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {contact.firstName} {contact.lastName}
                  </span>
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-2 py-0.5 text-xs font-bold text-black">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="card-panel flex min-h-[68svh] flex-col">
        <h2 className="font-display text-2xl">
          {selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : "Select a conversation"}
        </h2>

        <div className="mt-4 flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
          {messages.map((message) => {
            const mine = message.from?._id === currentUserId;
            return (
              <div key={message._id} className={`max-w-[86%] rounded-xl p-3 text-sm ${mine ? "ml-auto bg-cyan-700/35 text-cyan-50" : "bg-slate-800 text-slate-100"}`}>
                {message.text ? <p>{message.text}</p> : null}
                {message.voiceUrl ? <audio controls src={message.voiceUrl} className="w-full" /> : null}
                <p className="mt-1 text-[11px] text-slate-300/80">
                  {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2">
          <input className="auth-input h-11 flex-1" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your message" />
          <button className={`icon-btn ${recording ? "border-rose-500 text-rose-300" : ""}`} type="button" onClick={toggleRecording}>
            <Mic className="h-4 w-4" />
          </button>
          <button className="icon-btn" type="button" onClick={sendText}>
            <Send className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
