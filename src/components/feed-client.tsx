"use client";

import imageCompression from "browser-image-compression";
import { EditorContent, useEditor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import { formatDistanceToNow } from "date-fns";
import { AlignCenter, AlignLeft, AlignRight, CheckCircle2, Copy, Eye, EyeOff, FileText, HandHeart, Heart, ImagePlus, Lightbulb, MessageCircle, MoreHorizontal, PartyPopper, Pencil, Send, Share2, Sparkles, ThumbsUp, Trash2, Upload, UserPlus, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { playActionSound } from "@/components/sound";

type Media = {
  url: string;
  type: "image" | "pdf";
  width?: number;
  height?: number;
  name?: string;
  file?: File;
};

type Post = {
  _id: string;
  content: string;
  isHidden?: boolean;
  textStyle?: {
    backgroundColor?: string;
    textAlign?: "left" | "center" | "right";
  };
  media: Media[];
  reactions: { user: { _id: string }; type: string }[];
  comments: {
    user: { _id: string; firstName: string; lastName: string };
    text: string;
    createdAt: string;
  }[];
  author: { _id: string; firstName: string; lastName: string; avatar?: string };
  createdAt: string;
};

type SuggestedUser = {
  _id: string;
  firstName: string;
  lastName: string;
  bio?: string;
  avatar?: string;
};

const reactionOptions = [
  { type: "love", label: "Love", icon: Heart, color: "text-rose-300" },
  { type: "care", label: "Care", icon: HandHeart, color: "text-amber-300" },
  { type: "celebrate", label: "Celebrate", icon: PartyPopper, color: "text-cyan-300" },
  { type: "insightful", label: "Insightful", icon: Lightbulb, color: "text-violet-300" },
  { type: "support", label: "Support", icon: ThumbsUp, color: "text-emerald-300" },
] as const;

const textAlignOptions = [
  { value: "left", label: "Left", icon: AlignLeft },
  { value: "center", label: "Center", icon: AlignCenter },
  { value: "right", label: "Right", icon: AlignRight },
] as const;

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

function imageGridClass(total: number) {
  if (total <= 1) return "grid-cols-1";
  if (total === 2) return "grid-cols-2";
  if (total === 3) return "grid-cols-3";
  return "grid-cols-2 md:grid-cols-3";
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

type Props = {
  initialPosts: Post[];
  suggestedUsers: SuggestedUser[];
  currentUserId: string;
};

export default function FeedClient({ initialPosts, suggestedUsers, currentUserId }: Props) {
  const [posts, setPosts] = useState(initialPosts);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<Media[]>([]);
  const [resizePx, setResizePx] = useState(1600);
  const [activeImageEditorIndex, setActiveImageEditorIndex] = useState<number | null>(null);
  const [editorText, setEditorText] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openReactionPostId, setOpenReactionPostId] = useState<string | null>(null);
  const [openCommentPostId, setOpenCommentPostId] = useState<string | null>(null);
  const [openSharePostId, setOpenSharePostId] = useState<string | null>(null);
  const [openManagePostId, setOpenManagePostId] = useState<string | null>(null);
  const [openFocusPostId, setOpenFocusPostId] = useState<string | null>(null);
  const [openComposeModal, setOpenComposeModal] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [workingPostId, setWorkingPostId] = useState<string | null>(null);
  const [textBackgroundColor, setTextBackgroundColor] = useState("#1e293b");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("left");

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const indexedAttachments = useMemo(
    () => attachments.map((attachment, index) => ({ ...attachment, index })),
    [attachments]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TiptapImage,
      Placeholder.configure({ placeholder: "Write your deep thought, poem, or reflection..." }),
    ],
    content: "",
    onUpdate: ({ editor: currentEditor }) => setEditorText(currentEditor.getText()),
    editorProps: {
      attributes: {
        class:
          "min-h-[180px] rounded-xl border border-slate-700 p-4 leading-7 outline-none",
      } as unknown as Record<string, string>,
    },
  });

  const canPublish = useMemo(() => {
    const text = editorText.trim();
    return Boolean(text.length || attachments.length);
  }, [attachments.length, editorText]);

  const hasImageAttachments = useMemo(
    () => attachments.some((attachment) => attachment.type === "image"),
    [attachments]
  );

  const activeSharePost = useMemo(
    () => posts.find((post) => post._id === openSharePostId) ?? null,
    [openSharePostId, posts]
  );

  const editingPost = useMemo(
    () => posts.find((post) => post._id === editingPostId) ?? null,
    [editingPostId, posts]
  );

  const activeFocusPost = useMemo(
    () => posts.find((post) => post._id === openFocusPostId) ?? null,
    [openFocusPostId, posts]
  );

  const activeShareLink = useMemo(
    () =>
      openSharePostId && typeof window !== "undefined"
        ? `${window.location.origin}/?post=${openSharePostId}`
        : "",
    [openSharePostId]
  );

  const activeSharePreview = useMemo(() => {
    if (!activeSharePost) return "";
    const text = htmlToText(activeSharePost.content);
    return text.length > 140 ? `${text.slice(0, 140)}...` : text;
  }, [activeSharePost]);

  const closeFocusPost = useCallback(() => {
    setOpenFocusPostId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("post");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const hasModalOpen = Boolean(openSharePostId || openComposeModal || openFocusPostId);
    if (!hasModalOpen) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (openComposeModal) {
        setOpenComposeModal(false);
        return;
      }
      if (openFocusPostId) {
        closeFocusPost();
        return;
      }
      if (openSharePostId) {
        setOpenSharePostId(null);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onEscape);
    };
  }, [closeFocusPost, openComposeModal, openFocusPostId, openSharePostId]);

  useEffect(() => {
    const postId = searchParams.get("post");
    if (!postId) return;
    setOpenFocusPostId(postId);
  }, [searchParams]);

  const reloadPosts = async () => {
    const refresh = await fetch("/api/posts", { cache: "no-store" });
    const data = await refresh.json();
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

  const onPickImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    try {
      const draftImages: Media[] = files.map((file) => ({
        url: URL.createObjectURL(file),
        type: "image",
        name: file.name,
        file,
      }));

      setAttachments((prev) => {
        if (activeImageEditorIndex === null) {
          setActiveImageEditorIndex(prev.length);
        }
        return [...prev, ...draftImages];
      });
      toast.success("Image added. You can now resize manually.");
      playActionSound("success");
    } catch {
      toast.error("Image add failed");
    }

    event.target.value = "";
  };

  const onPickPdf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const result = await uploadAsset(file);
      setAttachments((prev) => [...prev, { url: result.url, type: "pdf", name: result.name }]);
      toast.success("PDF uploaded");
      playActionSound("success");
    } catch {
      toast.error("PDF upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const publishPost = async () => {
    if (!editor || !canPublish) return;

    setUploading(true);

    try {
      const mediaPayload: Media[] = [];

      for (const attachment of attachments) {
        if (attachment.type === "pdf") {
          mediaPayload.push({
            url: attachment.url,
            type: "pdf",
            name: attachment.name,
          });
          continue;
        }

        if (!attachment.file) continue;

        const result = await uploadAsset(attachment.file);
        mediaPayload.push({
          url: result.url,
          type: "image",
          name: result.name,
        });
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editor.getHTML(),
          media: mediaPayload,
          textStyle: {
            backgroundColor: textBackgroundColor,
            textAlign,
          },
        }),
      });

      if (!res.ok) {
        toast.error("Post publish failed");
        return;
      }

      attachments.forEach((attachment) => {
        if (attachment.type === "image" && attachment.url.startsWith("blob:")) {
          URL.revokeObjectURL(attachment.url);
        }
      });

      editor.commands.clearContent();
      setAttachments([]);
      setOpenComposeModal(false);
      setActiveImageEditorIndex(null);
      setTextBackgroundColor("#1e293b");
      setTextAlign("left");
      await reloadPosts();

      toast.success("Thought published");
      playActionSound("success");
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const target = prev[index];
      if (target?.type === "image" && target.url.startsWith("blob:")) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
    setActiveImageEditorIndex((prev) => (prev === index ? null : prev));
  };

  const applyImageResize = async (index: number) => {
    const target = attachments[index];
    if (!target || target.type !== "image" || !target.file) return;

    try {
      setUploading(true);
      const resized = await imageCompression(target.file, {
        maxSizeMB: 1.6,
        maxWidthOrHeight: resizePx,
        useWebWorker: true,
      });

      const resizedFile = new File([resized], target.file.name, { type: resized.type || target.file.type });
      const nextUrl = URL.createObjectURL(resizedFile);

      setAttachments((prev) => {
        const current = prev[index];
        if (!current || current.type !== "image") return prev;
        if (current.url.startsWith("blob:")) {
          URL.revokeObjectURL(current.url);
        }

        const next = [...prev];
        next[index] = {
          ...current,
          url: nextUrl,
          file: resizedFile,
          width: resizePx,
        };
        return next;
      });

      toast.success("Image resized");
    } catch {
      toast.error("Image resize failed");
    } finally {
      setUploading(false);
    }
  };

  const reactToPost = async (postId: string, type: string) => {
    const res = await fetch(`/api/posts/${postId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });

    if (!res.ok) {
      toast.error("Reaction failed");
      return;
    }

    await reloadPosts();
    playActionSound("react");
  };

  const commentOnPost = async (postId: string) => {
    const text = commentDrafts[postId]?.trim();
    if (!text) return;

    const res = await fetch(`/api/posts/${postId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      toast.error("Comment failed");
      return;
    }

    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    await reloadPosts();
    toast.success("Comment added");
  };

  const sharePost = async (postId: string) => {
    const link = `${window.location.origin}/?post=${postId}`;

    await navigator.clipboard.writeText(link);
    toast.success("Post link copied");
    setOpenSharePostId(null);
  };

  const shareToPlatform = (postId: string, platform: "facebook" | "linkedin" | "x" | "whatsapp") => {
    const link = `${window.location.origin}/?post=${postId}`;
    const encodedUrl = encodeURIComponent(link);
    const encodedText = encodeURIComponent("Read this SoulSync post");

    let targetUrl = "";
    if (platform === "facebook") {
      targetUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    }
    if (platform === "linkedin") {
      targetUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    }
    if (platform === "x") {
      targetUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
    }
    if (platform === "whatsapp") {
      targetUrl = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
    }

    if (targetUrl) {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }

    setOpenSharePostId(null);
  };

  const nativeSharePost = async (postId: string) => {
    const link = `${window.location.origin}/?post=${postId}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "SoulSync Post", text: "Read this SoulSync post", url: link });
        setOpenSharePostId(null);
        return;
      } catch {
        // ignored
      }
    }

    await sharePost(postId);
  };

  const sendConnection = async (targetUserId: string) => {
    const res = await fetch("/api/connection/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Connection request failed");
      return;
    }

    toast.success("Connection request sent");
    playActionSound("notification");
  };

  const openPostEditor = (post: Post) => {
    setEditingPostId(post._id);
    setEditText(htmlToText(post.content));
    setOpenManagePostId(null);
  };

  const closePostEditor = () => {
    setEditingPostId(null);
    setEditText("");
  };

  const savePostEdit = async () => {
    if (!editingPostId) return;
    setWorkingPostId(editingPostId);

    try {
      const res = await fetch(`/api/posts/${editingPostId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: textToHtml(editText) }),
      });

      if (!res.ok) {
        toast.error("Post update failed");
        return;
      }

      await reloadPosts();
      closePostEditor();
      toast.success("Post updated");
    } finally {
      setWorkingPostId(null);
    }
  };

  const deletePost = async (postId: string) => {
    const confirmed = window.confirm("Delete this post permanently?");
    if (!confirmed) return;

    setWorkingPostId(postId);
    setOpenManagePostId(null);
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

  const togglePostHidden = async (post: Post) => {
    setWorkingPostId(post._id);
    setOpenManagePostId(null);

    try {
      const shouldHide = !post.isHidden;
      const res = await fetch(`/api/posts/${post._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: shouldHide }),
      });

      if (!res.ok) {
        toast.error("Visibility update failed");
        return;
      }

      const data = await res.json();
      setPosts((prev) => prev.map((item) => (item._id === post._id ? data.post : item)));
      toast.success(shouldHide ? "Post hidden from others" : "Post is visible now");
    } finally {
      setWorkingPostId(null);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 px-4 py-6 lg:grid-cols-[1.5fr_0.8fr]">
      <section className="space-y-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <button
            type="button"
            onClick={() => setOpenComposeModal(true)}
            className="group relative w-full overflow-hidden rounded-2xl border border-cyan-400/35 bg-slate-900/70 p-5 text-left shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_18px_44px_rgba(2,132,199,0.24)] transition hover:-translate-y-0.5 hover:border-cyan-300/60 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_24px_52px_rgba(8,145,178,0.35)]"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl transition group-hover:bg-cyan-300/30" />
            <div className="pointer-events-none absolute -bottom-10 left-14 h-36 w-36 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="relative flex items-center justify-between gap-3">
              <div>
                <p className="mb-1 inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Quick Composer
                </p>
                <h2 className="font-display text-2xl text-slate-100 md:text-3xl">Compose New Story</h2>
                <p className="mt-1 text-sm text-slate-300">Click to open your writing studio in a focused popup.</p>
              </div>
              <span className="rounded-xl border border-cyan-400/30 bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-100">Open</span>
            </div>
          </button>
        </motion.div>

        {posts.map((post, i) => {
          const myReaction = post.reactions.find((r) => r.user?._id === currentUserId)?.type;
          const isOwner = post.author?._id === currentUserId;
          const authorFullName = `${post.author.firstName} ${post.author.lastName}`;
          const authorInitials = `${post.author.firstName?.[0] ?? ""}${post.author.lastName?.[0] ?? ""}`.toUpperCase();
          const postBackgroundColor = normalizeHexColor(post.textStyle?.backgroundColor) ?? "#1e293b";
          const postTextAlign = post.textStyle?.textAlign ?? "left";
          const postTextColor = getReadableTextColor(postBackgroundColor);

          return (
            <motion.article key={post._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card-panel">
              <div className="relative mb-3 flex items-center justify-between gap-3 text-sm text-slate-300">
                <Link href={`/profile/${post.author._id}`} className="inline-flex items-center gap-2 rounded-lg pr-2 transition hover:text-cyan-200">
                  {post.author.avatar ? (
                    <Image
                      src={post.author.avatar}
                      alt={authorFullName}
                      width={36}
                      height={36}
                      unoptimized
                      className="h-9 w-9 rounded-full border border-slate-700 object-cover"
                    />
                  ) : (
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200">
                      {authorInitials || "U"}
                    </span>
                  )}
                  <span>{authorFullName}</span>
                </Link>

                <div className="flex items-center gap-2">
                  <p>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</p>
                  {isOwner ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenManagePostId((prev) => (prev === post._id ? null : post._id))}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/80 text-slate-300 transition hover:bg-slate-800"
                        aria-label="Manage post"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      <AnimatePresence>
                        {openManagePostId === post._id ? (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            className="absolute right-0 top-10 z-30 w-44 rounded-xl border border-slate-700 bg-slate-900/95 p-1.5 shadow-xl"
                          >
                            <button
                              type="button"
                              onClick={() => openPostEditor(post)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit post
                            </button>
                            <button
                              type="button"
                              onClick={() => void togglePostHidden(post)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                              disabled={workingPostId === post._id}
                            >
                              {post.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                              {post.isHidden ? "Unhide post" : "Hide post"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void deletePost(post._id)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-200 transition hover:bg-rose-500/15"
                              disabled={workingPostId === post._id}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete post
                            </button>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                className="prose max-w-none rounded-xl px-4 py-3 shadow-inner **:text-inherit"
                style={{
                  backgroundColor: postBackgroundColor,
                  color: postTextColor,
                  textAlign: postTextAlign,
                }}
                dangerouslySetInnerHTML={{ __html: post.content }}
              />

              {post.media?.length ? (
                <div className="mt-4 space-y-2">
                  <div className={`grid gap-2 ${imageGridClass(post.media.filter((m) => m.type === "image").length)}`}>
                    {post.media
                      .filter((m) => m.type === "image")
                      .map((media) => (
                        <Image
                          key={media.url}
                          src={media.url}
                          alt={media.name ?? "post image"}
                          width={1400}
                          height={900}
                          unoptimized
                          className="h-auto max-h-136 w-full rounded-xl bg-slate-950/70 object-contain"
                        />
                      ))}
                  </div>
                  {post.media.filter((m) => m.type === "pdf").map((media) => (
                    <a key={media.url} href={media.url} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800">
                      <FileText className="h-4 w-4" />
                      {media.name ?? "PDF attachment"}
                    </a>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div
                  className="relative"
                  onMouseEnter={() => setOpenReactionPostId(post._id)}
                  onMouseLeave={() => setOpenReactionPostId((prev) => (prev === post._id ? null : prev))}
                >
                  <button className="icon-btn"><Heart className="h-4 w-4" />{myReaction ? `Reacted: ${myReaction}` : "React"}</button>
                  <AnimatePresence>
                    {openReactionPostId === post._id ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-full left-0 z-20 mb-2 flex items-center gap-2"
                      >
                        {reactionOptions.map((item, index) => {
                          const Icon = item.icon;
                          return (
                            <motion.button
                              key={item.type}
                              type="button"
                              initial={{ opacity: 0, y: 10, scale: 0.85 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.85 }}
                              transition={{ duration: 0.22, delay: index * 0.06 }}
                              title={item.label}
                              className="rounded-full border border-slate-700 bg-slate-900/95 p-2.5 shadow-lg transition hover:-translate-y-1 hover:scale-110 hover:bg-slate-800"
                              onClick={() => reactToPost(post._id, item.type)}
                            >
                              <Icon className={`h-4 w-4 ${item.color}`} />
                            </motion.button>
                          );
                        })}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <button
                  className="icon-btn"
                  onClick={() => setOpenCommentPostId((prev) => (prev === post._id ? null : post._id))}
                  type="button"
                >
                  <MessageCircle className="h-4 w-4" />
                  {post.comments.length} Comments
                </button>

                <button
                  className="icon-btn"
                  onClick={() => setOpenSharePostId((prev) => (prev === post._id ? null : post._id))}
                  type="button"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              </div>

              {openCommentPostId === post._id ? (
                <div className="mt-3 flex items-end gap-2">
                  <textarea
                    value={commentDrafts[post._id] ?? ""}
                    onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post._id]: e.target.value }))}
                    placeholder="Write a thoughtful comment"
                    rows={3}
                    className="w-full resize-y rounded-xl border border-slate-700/80 bg-slate-900/70 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-500"
                  />
                  <button className="icon-btn h-11" onClick={() => commentOnPost(post._id)} type="button"><Send className="h-4 w-4" /></button>
                </div>
              ) : null}

              {post.comments.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {post.comments.slice(-3).map((c, idx) => (
                    <p key={`${post._id}-comment-${idx}`} className="text-sm text-slate-300">
                      <span className="font-semibold text-slate-200">{c.user.firstName} {c.user.lastName}</span> {c.text}
                    </p>
                  ))}
                </div>
              ) : null}
            </motion.article>
          );
        })}
      </section>

      <aside className="space-y-5">
        <div className="card-panel">
          <h3 className="font-display text-xl">People You May Connect</h3>
          <div className="mt-3 space-y-2">
            {suggestedUsers.map((user) => (
              <div key={user._id} className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-3">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/profile/${user._id}`}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800"
                  >
                    {user.avatar ? (
                      <Image
                        src={user.avatar}
                        alt={`${user.firstName} ${user.lastName}`}
                        width={40}
                        height={40}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-slate-200">
                        {`${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "U"}
                      </span>
                    )}
                  </Link>

                  <div className="min-w-0">
                    <Link href={`/profile/${user._id}`} className="font-medium text-slate-200 transition hover:text-cyan-200">
                      {user.firstName} {user.lastName}
                    </Link>
                    <p className="line-clamp-2 text-xs text-slate-400">{user.bio || "A meaningful SoulSync member."}</p>
                  </div>
                </div>

                <button className="mt-2 inline-flex items-center gap-1 rounded-lg border border-cyan-500/50 px-2.5 py-1 text-xs text-cyan-200 hover:bg-cyan-600/10" onClick={() => sendConnection(user._id)} type="button">
                  <UserPlus className="h-3.5 w-3.5" />
                  Request Connection
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {openFocusPostId && activeFocusPost ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-90 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onClick={closeFocusPost}
          >
            <motion.article
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="hide-scrollbar card-panel relative max-h-[92vh] w-full max-w-3xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
                <p>{activeFocusPost.author.firstName} {activeFocusPost.author.lastName}</p>
                <div className="inline-flex items-center gap-2">
                  <p>{formatDistanceToNow(new Date(activeFocusPost.createdAt), { addSuffix: true })}</p>
                  <button
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/70 text-slate-300 transition hover:bg-slate-800"
                    type="button"
                    onClick={closeFocusPost}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div
                className="prose max-w-none rounded-xl px-4 py-3 shadow-inner **:text-inherit"
                style={{
                  backgroundColor: normalizeHexColor(activeFocusPost.textStyle?.backgroundColor) ?? "#1e293b",
                  color: getReadableTextColor(normalizeHexColor(activeFocusPost.textStyle?.backgroundColor) ?? "#1e293b"),
                  textAlign: activeFocusPost.textStyle?.textAlign ?? "left",
                }}
                dangerouslySetInnerHTML={{ __html: activeFocusPost.content }}
              />

              {activeFocusPost.media?.length ? (
                <div className="mt-4 space-y-2">
                  <div className={`grid gap-2 ${imageGridClass(activeFocusPost.media.filter((m) => m.type === "image").length)}`}>
                    {activeFocusPost.media
                      .filter((m) => m.type === "image")
                      .map((media) => (
                        <Image
                          key={`focus-${media.url}`}
                          src={media.url}
                          alt={media.name ?? "post image"}
                          width={1400}
                          height={900}
                          unoptimized
                          className="h-auto max-h-136 w-full rounded-xl bg-slate-950/70 object-contain"
                        />
                      ))}
                  </div>
                  {activeFocusPost.media.filter((m) => m.type === "pdf").map((media) => (
                    <a key={`focus-${media.url}`} href={media.url} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800">
                      <FileText className="h-4 w-4" />
                      {media.name ?? "PDF attachment"}
                    </a>
                  ))}
                </div>
              ) : null}
            </motion.article>
          </motion.div>
        ) : null}

      </AnimatePresence>

      <AnimatePresence>
        {editingPostId && editingPost ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-90 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onClick={closePostEditor}
          >
            <motion.article
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="card-panel w-full max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-xl text-slate-100">Edit Post</h3>
                <button
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/70 text-slate-300 transition hover:bg-slate-800"
                  type="button"
                  onClick={closePostEditor}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={8}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-900/70 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-500"
                placeholder="Refine your story"
              />

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closePostEditor}
                  className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void savePostEdit()}
                  disabled={workingPostId === editingPostId}
                  className="rounded-lg border border-cyan-500/60 bg-cyan-500/20 px-3 py-1.5 text-sm text-cyan-100 transition hover:bg-cyan-500/30 disabled:opacity-60"
                >
                  {workingPostId === editingPostId ? "Saving..." : "Save changes"}
                </button>
              </div>
            </motion.article>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {openComposeModal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-90 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onClick={() => setOpenComposeModal(false)}
          >
            <motion.article
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="card-panel hide-scrollbar relative max-h-[92vh] w-full max-w-4xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-28 left-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

              <div className="relative mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="mb-1 inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-cyan-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Publishing Studio
                  </p>
                  <h2 className="font-display text-2xl md:text-3xl">Compose New Story</h2>
                  <p className="mt-1 text-sm text-slate-400">Write deeply, attach visuals, and publish with confidence.</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    {attachments.length} attachment{attachments.length === 1 ? "" : "s"}
                  </div>
                  <button
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/70 text-slate-300 transition hover:bg-slate-800"
                    type="button"
                    onClick={() => setOpenComposeModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div
                className="mt-4 rounded-xl"
                style={{
                  backgroundColor: textBackgroundColor,
                  color: getReadableTextColor(textBackgroundColor),
                }}
              >
                <EditorContent editor={editor} className="tiptap-shell" />
              </div>

              <div className="mt-4 rounded-2xl border border-slate-700/60 bg-slate-900/35 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Text Style</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {textBackgroundPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTextBackgroundColor(preset)}
                      className={`h-8 w-8 rounded-full border ${textBackgroundColor === preset ? "border-cyan-300" : "border-slate-600"}`}
                      style={{ backgroundColor: preset }}
                      aria-label={`Set text background ${preset}`}
                    />
                  ))}

                  <label className="ml-1 inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-950/60 px-2 py-1 text-xs text-slate-300">
                    Custom
                    <input
                      type="color"
                      value={textBackgroundColor}
                      onChange={(e) => setTextBackgroundColor(e.target.value)}
                      className="h-6 w-8 cursor-pointer rounded border-none bg-transparent p-0"
                      aria-label="Custom text background color"
                    />
                  </label>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {textAlignOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTextAlign(option.value)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${
                          textAlign === option.value
                            ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-100"
                            : "border-slate-600 bg-slate-950/60 text-slate-300 hover:border-slate-500"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/35 p-3 md:grid-cols-2">
                <label className="group flex h-full cursor-pointer flex-col justify-between rounded-xl border border-slate-700/80 bg-slate-950/40 p-3 transition hover:border-cyan-500/50 hover:bg-cyan-500/10">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 bg-slate-900/80 text-cyan-200">
                    <ImagePlus className="h-4 w-4" />
                  </div>
                  <div className="mt-3">
                    <p className="font-medium text-slate-100">Upload image(s)</p>
                    <p className="mt-1 text-xs text-slate-400">Auto-compressed with your resize setting</p>
                  </div>
                  <input type="file" className="hidden" multiple accept="image/*" onChange={onPickImage} />
                </label>

                <label className="group flex h-full cursor-pointer flex-col justify-between rounded-xl border border-slate-700/80 bg-slate-950/40 p-3 transition hover:border-cyan-500/50 hover:bg-cyan-500/10">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 bg-slate-900/80 text-cyan-200">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="mt-3">
                    <p className="font-medium text-slate-100">Upload PDF</p>
                    <p className="mt-1 text-xs text-slate-400">Share notes, essays, or supporting docs</p>
                  </div>
                  <input type="file" className="hidden" accept="application/pdf" onChange={onPickPdf} />
                </label>
              </div>

              {hasImageAttachments ? (
                <div className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-950/35 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Image Quality</p>
                    <p className="text-xs text-slate-400">Visible only after adding image</p>
                  </div>
                  <p className="text-sm text-slate-200">Resize width: <span className="font-semibold text-cyan-200">{resizePx}px</span></p>
                  <input
                    type="range"
                    min={900}
                    max={2400}
                    step={100}
                    value={resizePx}
                    onChange={(e) => setResizePx(Number(e.target.value))}
                    className="mt-3 w-full accent-cyan-400"
                  />
                  <p className="mt-2 text-xs text-slate-400">Select an image below, then click Resize to apply manually.</p>
                </div>
              ) : null}

              {attachments.length > 0 ? (
                <div className="relative mt-4 space-y-3 rounded-2xl border border-slate-700/60 bg-slate-900/30 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-200">Pending attachments</p>
                    <p className="text-xs text-slate-400">{attachments.length} ready to publish</p>
                  </div>

                  <div className={`grid gap-2 ${imageGridClass(indexedAttachments.filter((m) => m.type === "image").length)}`}>
                    {indexedAttachments
                      .filter((m) => m.type === "image")
                      .map((m) => (
                        <div key={`${m.url}-${m.index}`} className="relative overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950/70 p-1">
                          <Image
                            src={m.url}
                            alt={m.name ?? "image"}
                            width={1200}
                            height={800}
                            unoptimized
                            className="h-auto max-h-72 w-full rounded-lg bg-slate-950/70 object-contain"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-600 bg-slate-950/90 text-slate-200 transition hover:border-rose-400/60 hover:text-rose-200"
                            onClick={() => removeAttachment(m.index)}
                            aria-label="Remove image"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <div className="absolute bottom-3 left-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveImageEditorIndex(m.index)}
                              className="rounded-lg border border-slate-600 bg-slate-950/90 px-2.5 py-1 text-xs text-slate-100 transition hover:border-cyan-500/60 hover:text-cyan-200"
                            >
                              Edit
                            </button>
                            {activeImageEditorIndex === m.index ? (
                              <button
                                type="button"
                                onClick={() => void applyImageResize(m.index)}
                                disabled={uploading}
                                className="rounded-lg border border-cyan-500/50 bg-cyan-500/20 px-2.5 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/30 disabled:opacity-60"
                              >
                                Resize
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {indexedAttachments
                      .filter((m) => m.type === "pdf")
                      .map((m) => (
                        <div key={`${m.url}-${m.index}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
                          <a href={m.url} target="_blank" className="inline-flex items-center gap-2 hover:text-cyan-200">
                            <FileText className="h-4 w-4" />
                            {m.name ?? "PDF"}
                          </a>
                          <button
                            type="button"
                            onClick={() => removeAttachment(m.index)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-300 transition hover:bg-slate-800 hover:text-rose-200"
                            aria-label="Remove PDF"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-400">Tip: keep stories concise and visual for better engagement.</p>
                <button className="auth-button" type="button" disabled={!canPublish || uploading} onClick={publishPost}>
                  <Upload className="mr-1 inline h-4 w-4" />
                  {uploading ? "Uploading..." : "Publish Post"}
                </button>
              </div>
            </motion.article>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {openSharePostId ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-90 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onClick={() => setOpenSharePostId(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-display text-xl text-slate-100">Share This Post</h4>
                <button
                  className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"
                  type="button"
                  onClick={() => setOpenSharePostId(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mb-4 text-sm text-slate-400">
                Choose where you want to share this story.
              </p>

              <div className="mb-4 rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Link Preview</p>
                <p className="mt-2 line-clamp-3 text-sm text-slate-200">
                  {activeSharePreview || "A new SoulSync story is waiting for you."}
                </p>
              </div>

              <div className="mb-4 rounded-xl border border-slate-700 bg-slate-950/70 p-2">
                <div className="flex items-center gap-2">
                  <input
                    className="h-10 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-slate-300 outline-none"
                    readOnly
                    value={activeShareLink}
                  />
                  <button
                    className="inline-flex h-10 items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 text-xs text-cyan-100 hover:bg-cyan-500/25"
                    type="button"
                    onClick={() => openSharePostId && void sharePost(openSharePostId)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  className="rounded-xl border border-slate-700 px-3 py-3 text-sm text-slate-200 transition hover:bg-slate-800"
                  type="button"
                  onClick={() => void sharePost(openSharePostId)}
                >
                  <Copy className="mr-1 inline h-4 w-4" />
                  Copy Link
                </button>
                <button className="rounded-xl border border-slate-700 px-3 py-3 text-sm text-slate-200 transition hover:bg-slate-800" type="button" onClick={() => shareToPlatform(openSharePostId, "facebook")}>Share to Facebook</button>
                <button className="rounded-xl border border-slate-700 px-3 py-3 text-sm text-slate-200 transition hover:bg-slate-800" type="button" onClick={() => shareToPlatform(openSharePostId, "linkedin")}>Share to LinkedIn</button>
                <button className="rounded-xl border border-slate-700 px-3 py-3 text-sm text-slate-200 transition hover:bg-slate-800" type="button" onClick={() => shareToPlatform(openSharePostId, "x")}>Share to X</button>
                <button className="rounded-xl border border-slate-700 px-3 py-3 text-sm text-slate-200 transition hover:bg-slate-800" type="button" onClick={() => shareToPlatform(openSharePostId, "whatsapp")}>Share to WhatsApp</button>
                <button className="rounded-xl border border-slate-700 px-3 py-3 text-sm text-slate-200 transition hover:bg-slate-800" type="button" onClick={() => void nativeSharePost(openSharePostId)}>
                  Native Share
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
