"use client";

import { formatDistanceToNow } from "date-fns";
import { Camera, Check, Eye, EyeOff, FileText, Pencil, Save, Trash2, Upload, UserCheck, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type ChangeEvent, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import { playActionSound } from "@/components/sound";

type PendingRequester = {
  _id: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
};

type UserProfile = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  phone?: string;
  age?: number;
  birthDate?: string;
  gender: "male" | "female" | "non-binary" | "prefer-not-to-say";
  bio?: string;
  pendingReceived?: Array<string | PendingRequester>;
  connections?: string[];
};

type Props = {
  initialUser: UserProfile;
  initialPosts: ManagedPost[];
};

type Media = {
  url: string;
  type: "image" | "pdf";
  width?: number;
  height?: number;
  name?: string;
  file?: File;
};

type ManagedPost = {
  _id: string;
  content: string;
  textStyle?: {
    backgroundColor?: string;
    textAlign?: "left" | "center" | "right";
  };
  isHidden?: boolean;
  media: Media[];
  comments: { _id?: string }[];
  reactions: { _id?: string }[];
  createdAt: string;
};

const textBackgroundPresets = ["#0f172a", "#1e293b", "#14532d", "#0f766e", "#7f1d1d", "#581c87"];

function normalizeHexColor(value: string | undefined) {
  if (!value) return null;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
}

function getReadableTextColor(hexColor: string) {
  const normalized = normalizeHexColor(hexColor);
  if (!normalized) return "#e2e8f0";

  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 160 ? "#0f172a" : "#e2e8f0";
}

function htmlToText(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textToHtml(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  if (!nonEmpty.length) return "";
  return nonEmpty.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function calculateAgeFromBirthDate(birthDate: string | undefined) {
  if (!birthDate) return null;

  const parsed = new Date(birthDate);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function formatBirthDateForInput(birthDate: string | undefined) {
  if (!birthDate) return "";
  return birthDate.length >= 10 ? birthDate.slice(0, 10) : birthDate;
}

function parseRequester(requester: string | PendingRequester) {
  if (typeof requester === "string") {
    return {
      id: requester,
      firstName: "Unknown",
      lastName: "User",
      avatar: "",
      isFallback: true,
    };
  }

  return {
    id: requester._id,
    firstName: requester.firstName || "Unknown",
    lastName: requester.lastName || "User",
    avatar: requester.avatar || "",
    isFallback: false,
  };
}

export default function ProfileClient({ initialUser, initialPosts }: Props) {
  const [user, setUser] = useState(initialUser);
  const [posts, setPosts] = useState(initialPosts);
  const [saving, setSaving] = useState(false);
  const [openProfileManageMenu, setOpenProfileManageMenu] = useState(false);
  const [openProfileEditor, setOpenProfileEditor] = useState(false);
  const [workingPostId, setWorkingPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editMedia, setEditMedia] = useState<Media[]>([]);
  const [editBackgroundColor, setEditBackgroundColor] = useState("#1e293b");
  const [editTextAlign, setEditTextAlign] = useState<"left" | "center" | "right">("left");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const editingPost = useMemo(
    () => posts.find((post) => post._id === editingPostId) ?? null,
    [editingPostId, posts]
  );

  const reloadPosts = async () => {
    const res = await fetch("/api/profile/posts", { cache: "no-store" });
    if (!res.ok) {
      toast.error("Could not refresh posts");
      return;
    }

    const data = await res.json();
    setPosts(data.posts ?? []);
  };

  const uploadAsset = async (file: File) => {
    const body = new FormData();
    body.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body,
    });

    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  };

  const openEditor = (post: ManagedPost) => {
    setEditingPostId(post._id);
    setEditText(htmlToText(post.content));
    setEditMedia(post.media ?? []);
    setEditBackgroundColor(normalizeHexColor(post.textStyle?.backgroundColor) ?? "#1e293b");
    setEditTextAlign(post.textStyle?.textAlign ?? "left");
  };

  const closeEditor = () => {
    setEditingPostId(null);
    setEditText("");
    setEditMedia([]);
    setEditBackgroundColor("#1e293b");
    setEditTextAlign("left");
  };

  const onAddEditMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const nextMedia = files
      .filter((file) => file.type.startsWith("image/") || file.type === "application/pdf")
      .map((file) => ({
        url: URL.createObjectURL(file),
        type: file.type.startsWith("image/") ? "image" : "pdf",
        name: file.name,
        file,
      })) as Media[];

    setEditMedia((prev) => [...prev, ...nextMedia]);
    event.target.value = "";
    toast.success("Attachment added");
  };

  const removeEditMedia = (index: number) => {
    setEditMedia((prev) => {
      const current = prev[index];
      if (current?.url?.startsWith("blob:")) {
        URL.revokeObjectURL(current.url);
      }
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const savePostEdit = async () => {
    if (!editingPostId) return;
    setWorkingPostId(editingPostId);

    try {
      const mediaPayload: Media[] = [];

      for (const media of editMedia) {
        if (!media.file) {
          mediaPayload.push({
            url: media.url,
            type: media.type,
            name: media.name,
            width: media.width,
            height: media.height,
          });
          continue;
        }

        const uploaded = await uploadAsset(media.file);
        mediaPayload.push({
          url: uploaded.url,
          type: media.type,
          name: uploaded.name ?? media.name,
          width: media.width,
          height: media.height,
        });
      }

      const res = await fetch(`/api/posts/${editingPostId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: textToHtml(editText),
          media: mediaPayload,
          textStyle: {
            backgroundColor: editBackgroundColor,
            textAlign: editTextAlign,
          },
        }),
      });

      if (!res.ok) {
        toast.error("Post update failed");
        return;
      }

      await reloadPosts();
      closeEditor();
      toast.success("Post updated");
      playActionSound("success");
    } catch {
      toast.error("Post update failed");
    } finally {
      setWorkingPostId(null);
    }
  };

  const deletePost = async (postId: string) => {
    const confirmed = window.confirm("Delete this post permanently?");
    if (!confirmed) return;

    setWorkingPostId(postId);
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Delete failed");
        return;
      }

      setPosts((prev) => prev.filter((post) => post._id !== postId));
      toast.success("Post deleted");
      playActionSound("notification");
    } finally {
      setWorkingPostId(null);
    }
  };

  const togglePostHidden = async (postId: string, shouldHide: boolean) => {
    setWorkingPostId(postId);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: shouldHide }),
      });

      if (!res.ok) {
        toast.error("Visibility update failed");
        return;
      }

      const data = await res.json();
      setPosts((prev) => prev.map((post) => (post._id === postId ? data.post : post)));
      toast.success(shouldHide ? "Post hidden from others" : "Post is visible now");
    } finally {
      setWorkingPostId(null);
    }
  };

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
        age: calculateAgeFromBirthDate(user.birthDate) ?? Number(user.age || 0),
        birthDate: user.birthDate || "",
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
    setOpenProfileEditor(false);
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

  const rejectConnection = async (requesterId: string) => {
    const res = await fetch("/api/connection/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterId }),
    });

    if (!res.ok) {
      toast.error("Could not reject request");
      return;
    }

    toast.success("Connection request rejected");
    playActionSound("notification");

    const refetch = await fetch("/api/profile", { cache: "no-store" });
    const data = await refetch.json();
    setUser(data.user);
  };

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 px-4 py-6 lg:grid-cols-[1.35fr_0.65fr]">
      <section className="space-y-5">
        <article className="card-panel">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl">Your Timeline</h2>
            <p className="text-sm text-slate-300">{posts.length} post{posts.length === 1 ? "" : "s"}</p>
          </div>

          {posts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No posts yet. Publish something from Feed to manage it here.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {posts.map((post) => {
                const backgroundColor = normalizeHexColor(post.textStyle?.backgroundColor) ?? "#1e293b";
                const textColor = getReadableTextColor(backgroundColor);
                const textAlign = post.textStyle?.textAlign ?? "left";
                const isBusy = workingPostId === post._id;

                return (
                  <div key={post._id} className="rounded-2xl border border-slate-700/70 bg-slate-900/35 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <p>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</p>
                      <span className={`rounded-full border px-2 py-0.5 ${post.isHidden ? "border-amber-500/50 bg-amber-500/15 text-amber-200" : "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"}`}>
                        {post.isHidden ? "Hidden" : "Visible"}
                      </span>
                    </div>

                    <div
                      className="mt-3 rounded-xl px-4 py-3 text-sm **:text-inherit"
                      style={{
                        backgroundColor,
                        color: textColor,
                        textAlign,
                      }}
                      dangerouslySetInnerHTML={{ __html: post.content || "<p>(No text)</p>" }}
                    />

                    {post.media?.length ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {post.media.map((media, index) => (
                          media.type === "image" ? (
                            <Image
                              key={`${post._id}-media-${index}`}
                              src={media.url}
                              alt={media.name ?? "post image"}
                              width={1200}
                              height={900}
                              unoptimized
                              className="h-auto max-h-64 w-full rounded-xl border border-slate-700/70 bg-slate-950/60 object-contain"
                            />
                          ) : (
                            <a
                              key={`${post._id}-media-${index}`}
                              href={media.url}
                              target="_blank"
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500/50"
                            >
                              <FileText className="h-4 w-4" />
                              {media.name ?? "PDF attachment"}
                            </a>
                          )
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => openEditor(post)}
                        disabled={isBusy}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => togglePostHidden(post._id, !post.isHidden)}
                        disabled={isBusy}
                      >
                        {post.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        {post.isHidden ? "Unhide" : "Hide"}
                      </button>
                      <button
                        type="button"
                        className="icon-btn border-rose-500/50 text-rose-200 hover:bg-rose-950/40"
                        onClick={() => void deletePost(post._id)}
                        disabled={isBusy}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                      <p className="ml-auto text-xs text-slate-400">
                        {post.reactions.length} reactions • {post.comments.length} comments
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>

      <aside className="space-y-5">
        <div className="card-panel">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-xl">Avatar</p>
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-3 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-500/25"
                onClick={() => setOpenProfileManageMenu((prev) => !prev)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>

              {openProfileManageMenu ? (
                <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-slate-700 bg-slate-900/95 p-1.5 shadow-xl">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                    onClick={() => {
                      setOpenProfileEditor(true);
                      setOpenProfileManageMenu(false);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit profile
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                    onClick={() => {
                      avatarInputRef.current?.click();
                      setOpenProfileManageMenu(false);
                    }}
                  >
                    <Camera className="h-4 w-4" />
                    Change avatar
                  </button>
                </div>
              ) : null}
            </div>
          </div>

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
            <p className="text-sm text-slate-400">Use the Edit button to manage profile details.</p>
            <input ref={avatarInputRef} type="file" className="hidden" accept="image/*" onChange={uploadAvatar} />
          </div>

          <div className="mt-4 rounded-xl border border-slate-700/70 bg-slate-900/40 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Profile Details</p>
            <div className="mt-2 space-y-2 text-sm">
              <p className="text-slate-300"><span className="text-slate-500">Name:</span> {user.firstName} {user.lastName}</p>
              <p className="text-slate-300"><span className="text-slate-500">Email:</span> {user.email || "Not set"}</p>
              <p className="text-slate-300"><span className="text-slate-500">Mobile:</span> {user.phone || "Not set"}</p>
              <p className="text-slate-300"><span className="text-slate-500">Birth date:</span> {user.birthDate ? new Date(user.birthDate).toLocaleDateString() : "Not set"}</p>
              <p className="text-slate-300"><span className="text-slate-500">Age:</span> {calculateAgeFromBirthDate(user.birthDate) ?? (user.age && user.age > 0 ? user.age : null) ?? "Not set"}</p>
              <p className="text-slate-300"><span className="text-slate-500">Gender:</span> {user.gender || "Not set"}</p>
              <p className="text-slate-300"><span className="text-slate-500">Bio:</span> {user.bio || "Not set"}</p>
            </div>
          </div>
        </div>

        <div className="card-panel">
          <p className="font-display text-xl">Connection Requests</p>
          <div className="mt-3 space-y-2">
            {(user.pendingReceived || []).length === 0 ? (
              <p className="text-sm text-slate-400">No pending requests.</p>
            ) : (
              (user.pendingReceived || []).map((requester) => {
                const parsed = parseRequester(requester);
                const initials = `${parsed.firstName?.[0] ?? ""}${parsed.lastName?.[0] ?? ""}`.toUpperCase() || "U";

                return (
                <div key={parsed.id} className="rounded-xl border border-slate-700 bg-slate-900/40 p-2">
                  <Link href={`/profile/${parsed.id}`} className="flex items-center gap-2 rounded-lg p-1 transition hover:bg-slate-800/70">
                    {parsed.avatar ? (
                      <Image
                        src={parsed.avatar}
                        alt={`${parsed.firstName} ${parsed.lastName}`}
                        width={36}
                        height={36}
                        unoptimized
                        className="h-9 w-9 rounded-full border border-slate-700 object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200">
                        {initials}
                      </span>
                    )}

                    <span className="text-sm text-slate-200">
                      {parsed.firstName} {parsed.lastName}
                    </span>
                  </Link>

                  {parsed.isFallback ? (
                    <p className="mt-1 px-1 text-xs text-slate-500">User details are not available for this request.</p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/50 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-700/15" type="button" onClick={() => acceptConnection(parsed.id)}>
                      <Check className="h-3.5 w-3.5" />
                      Accept
                    </button>
                    <button className="inline-flex items-center gap-1 rounded-lg border border-rose-500/50 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-700/15" type="button" onClick={() => rejectConnection(parsed.id)}>
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              );
              })
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

      {editingPost ? (
        <div className="fixed inset-0 z-90 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="hide-scrollbar card-panel max-h-[92vh] w-full max-w-3xl overflow-y-auto">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="font-display text-2xl">Edit Post</h3>
              <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/70" type="button" onClick={closeEditor}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="text-sm text-slate-300">
              Text
              <textarea
                rows={6}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="mt-2 w-full resize-y rounded-xl border border-slate-700/80 bg-slate-900/70 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-500"
                placeholder="Edit your post text"
              />
            </label>

            <div className="mt-4 rounded-2xl border border-slate-700/60 bg-slate-900/35 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Text Style</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {textBackgroundPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setEditBackgroundColor(preset)}
                    className={`h-8 w-8 rounded-full border ${editBackgroundColor === preset ? "border-cyan-300" : "border-slate-600"}`}
                    style={{ backgroundColor: preset }}
                    aria-label={`Set text background ${preset}`}
                  />
                ))}

                <label className="ml-1 inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-950/60 px-2 py-1 text-xs text-slate-300">
                  Custom
                  <input
                    type="color"
                    value={editBackgroundColor}
                    onChange={(e) => setEditBackgroundColor(e.target.value)}
                    className="h-6 w-8 cursor-pointer rounded border-none bg-transparent p-0"
                    aria-label="Custom text background color"
                  />
                </label>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEditTextAlign("left")}
                  className={`rounded-lg border px-3 py-1.5 ${editTextAlign === "left" ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-100" : "border-slate-600 bg-slate-950/60 text-slate-300"}`}
                >
                  Left
                </button>
                <button
                  type="button"
                  onClick={() => setEditTextAlign("center")}
                  className={`rounded-lg border px-3 py-1.5 ${editTextAlign === "center" ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-100" : "border-slate-600 bg-slate-950/60 text-slate-300"}`}
                >
                  Center
                </button>
                <button
                  type="button"
                  onClick={() => setEditTextAlign("right")}
                  className={`rounded-lg border px-3 py-1.5 ${editTextAlign === "right" ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-100" : "border-slate-600 bg-slate-950/60 text-slate-300"}`}
                >
                  Right
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-700/60 bg-slate-900/30 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-200">Manage attachments</p>
                <label className="upload-btn h-9 px-3">
                  <Upload className="h-4 w-4" />
                  Add media
                  <input type="file" className="hidden" multiple accept="image/*,application/pdf" onChange={onAddEditMedia} />
                </label>
              </div>

              {editMedia.length === 0 ? (
                <p className="text-sm text-slate-400">No attachments</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {editMedia.map((media, index) => (
                    <div key={`${media.url}-${index}`} className="relative rounded-xl border border-slate-700/70 bg-slate-950/60 p-2">
                      {media.type === "image" ? (
                        <Image
                          src={media.url}
                          alt={media.name ?? "image"}
                          width={1200}
                          height={800}
                          unoptimized
                          className="h-auto max-h-52 w-full rounded-lg object-contain"
                        />
                      ) : (
                        <div className="inline-flex items-center gap-2 text-sm text-slate-200">
                          <FileText className="h-4 w-4" />
                          {media.name ?? "PDF"}
                        </div>
                      )}
                      <button
                        type="button"
                        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-600 bg-slate-950/90 text-slate-200 hover:border-rose-500/60 hover:text-rose-200"
                        onClick={() => removeEditMedia(index)}
                        aria-label="Remove media"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button className="icon-btn" type="button" onClick={closeEditor}>
                Cancel
              </button>
              <button className="auth-button h-11" type="button" onClick={() => void savePostEdit()} disabled={workingPostId === editingPostId}>
                <Save className="mr-1 h-4 w-4" />
                {workingPostId === editingPostId ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {openProfileEditor ? (
        <div className="fixed inset-0 z-90 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="hide-scrollbar card-panel max-h-[92vh] w-full max-w-3xl overflow-y-auto">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="font-display text-2xl">Profile Management</h3>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/70"
                type="button"
                onClick={() => setOpenProfileEditor(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

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
                Birth date
                <input
                  className="auth-input"
                  type="date"
                  value={formatBirthDateForInput(user.birthDate)}
                  onChange={(e) => {
                    const nextBirthDate = e.target.value;
                    const calculatedAge = calculateAgeFromBirthDate(nextBirthDate) ?? 0;
                    setUser((prev) => ({ ...prev, birthDate: nextBirthDate, age: calculatedAge }));
                  }}
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                Age
                <input className="auth-input opacity-70" type="number" value={(calculateAgeFromBirthDate(user.birthDate) ?? user.age) || 0} disabled />
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

            <div className="mt-4 flex justify-end gap-2">
              <button className="icon-btn" type="button" onClick={() => setOpenProfileEditor(false)}>
                Cancel
              </button>
              <button className="auth-button h-11" type="button" onClick={save} disabled={saving}>
                <Save className="mr-1 h-4 w-4" />
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
