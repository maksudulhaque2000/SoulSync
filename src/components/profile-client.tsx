"use client";

import { Camera, Check, UserCheck } from "lucide-react";
import Image from "next/image";
import { type ChangeEvent, useState } from "react";
import toast from "react-hot-toast";

import { playActionSound } from "@/components/sound";

type UserProfile = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  phone?: string;
  age?: number;
  gender: "male" | "female" | "non-binary" | "prefer-not-to-say";
  bio?: string;
  pendingReceived?: string[];
  connections?: string[];
};

type Props = {
  initialUser: UserProfile;
};

export default function ProfileClient({ initialUser }: Props) {
  const [user, setUser] = useState(initialUser);
  const [saving, setSaving] = useState(false);

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const body = new FormData();
    body.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body });
    if (!res.ok) {
      toast.error("Avatar upload failed");
      return;
    }

    const data = await res.json();
    setUser((prev) => ({ ...prev, avatar: data.url }));
    toast.success("Avatar uploaded");
    playActionSound("success");
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        phone: user.phone,
        age: Number(user.age || 0),
        gender: user.gender,
        bio: user.bio,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      toast.error("Profile update failed");
      return;
    }

    const data = await res.json();
    setUser((prev) => ({ ...prev, ...data.user }));
    toast.success("Profile updated");
    playActionSound("success");
  };

  const acceptConnection = async (requesterId: string) => {
    const res = await fetch("/api/connection/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterId }),
    });

    if (!res.ok) {
      toast.error("Could not accept request");
      return;
    }

    toast.success("Connection accepted");
    playActionSound("notification");

    const refetch = await fetch("/api/profile", { cache: "no-store" });
    const data = await refetch.json();
    setUser(data.user);
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 px-4 py-6 lg:grid-cols-[1.3fr_0.7fr]">
      <section className="card-panel space-y-5">
        <h1 className="font-display text-3xl">Profile Management</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            First name
            <input className="auth-input" value={user.firstName} onChange={(e) => setUser((prev) => ({ ...prev, firstName: e.target.value }))} />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            Last name
            <input className="auth-input" value={user.lastName} onChange={(e) => setUser((prev) => ({ ...prev, lastName: e.target.value }))} />
          </label>
          <label className="space-y-2 text-sm text-slate-300 md:col-span-2">
            Email (read only)
            <input className="auth-input opacity-60" value={user.email} disabled />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            Mobile
            <input className="auth-input" value={user.phone || ""} onChange={(e) => setUser((prev) => ({ ...prev, phone: e.target.value }))} />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            Age
            <input className="auth-input" type="number" value={user.age || 0} onChange={(e) => setUser((prev) => ({ ...prev, age: Number(e.target.value) }))} />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            Gender
            <select className="auth-input" value={user.gender} onChange={(e) => setUser((prev) => ({ ...prev, gender: e.target.value as UserProfile["gender"] }))}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non-binary">Non-binary</option>
              <option value="prefer-not-to-say">Prefer not to say</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-300 md:col-span-2">
            Bio
            <textarea className="auth-input min-h-28" value={user.bio || ""} onChange={(e) => setUser((prev) => ({ ...prev, bio: e.target.value }))} />
          </label>
        </div>

        <button className="auth-button" type="button" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </section>

      <aside className="space-y-5">
        <div className="card-panel">
          <p className="font-display text-xl">Avatar</p>
          <div className="mt-3 flex items-center gap-3">
            {user.avatar ? (
              <Image
                src={user.avatar}
                alt="avatar"
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-slate-800" />
            )}
            <label className="upload-btn">
              <Camera className="h-4 w-4" />
              Change
              <input type="file" className="hidden" accept="image/*" onChange={uploadAvatar} />
            </label>
          </div>
        </div>

        <div className="card-panel">
          <p className="font-display text-xl">Connection Requests</p>
          <div className="mt-3 space-y-2">
            {(user.pendingReceived || []).length === 0 ? (
              <p className="text-sm text-slate-400">No pending requests.</p>
            ) : (
              (user.pendingReceived || []).map((id) => (
                <div key={id} className="rounded-xl border border-slate-700 bg-slate-900/40 p-2">
                  <p className="text-sm text-slate-300">Requester ID: {id}</p>
                  <button className="mt-2 inline-flex items-center gap-1 rounded-lg border border-emerald-500/50 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-700/15" type="button" onClick={() => acceptConnection(id)}>
                    <Check className="h-3.5 w-3.5" />
                    Accept
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card-panel">
          <p className="font-display text-xl">Connections</p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-300">
            <UserCheck className="h-4 w-4 text-cyan-300" />
            {(user.connections || []).length} connected users
          </p>
        </div>
      </aside>
    </div>
  );
}
