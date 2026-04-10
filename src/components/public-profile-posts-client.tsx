"use client";

import { formatDistanceToNow } from "date-fns";
import { Copy, FileText, HandHeart, Heart, Lightbulb, MessageCircle, PartyPopper, Send, Share2, ThumbsUp } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { playActionSound } from "@/components/sound";

type PublicMedia = {
  url: string;
  type: "image" | "pdf";
  name?: string;
};

type PublicReaction = {
  user: { _id: string };
  type: "love" | "care" | "celebrate" | "insightful" | "support";
};

type PublicComment = {
  user: { _id: string; firstName: string; lastName: string };
  text: string;
  createdAt: string;
};

type PublicPost = {
  _id: string;
  content: string;
  createdAt: string;
  textStyle?: {
    backgroundColor?: string;
    textAlign?: "left" | "center" | "right";
  };
  media?: PublicMedia[];
  reactions: PublicReaction[];
  comments: PublicComment[];
  author: {
    _id: string;
    firstName: string;
    lastName: string;
  };
};

type Props = {
  initialPosts: PublicPost[];
  currentUserId: string;
};

const reactionOptions = [
  { type: "love", label: "Love", icon: Heart, color: "text-rose-300" },
  { type: "care", label: "Care", icon: HandHeart, color: "text-amber-300" },
  { type: "celebrate", label: "Celebrate", icon: PartyPopper, color: "text-cyan-300" },
  { type: "insightful", label: "Insightful", icon: Lightbulb, color: "text-violet-300" },
  { type: "support", label: "Support", icon: ThumbsUp, color: "text-emerald-300" },
] as const;

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

export default function PublicProfilePostsClient({ initialPosts, currentUserId }: Props) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openReactionPostId, setOpenReactionPostId] = useState<string | null>(null);
  const [openCommentPostId, setOpenCommentPostId] = useState<string | null>(null);
  const [openSharePostId, setOpenSharePostId] = useState<string | null>(null);

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  const activeSharePost = useMemo(
    () => posts.find((post) => post._id === openSharePostId) ?? null,
    [openSharePostId, posts]
  );

  const activeShareLink = useMemo(
    () =>
      openSharePostId && typeof window !== "undefined"
        ? `${window.location.origin}/feed?post=${openSharePostId}`
        : "",
    [openSharePostId]
  );

  const activeSharePreview = useMemo(() => {
    if (!activeSharePost) return "";
    const text = htmlToText(activeSharePost.content);
    return text.length > 140 ? `${text.slice(0, 140)}...` : text;
  }, [activeSharePost]);

  const refreshPosts = () => {
    router.refresh();
    setPosts((prev) => prev);
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

    refreshPosts();
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
    refreshPosts();
    toast.success("Comment added");
    playActionSound("notification");
  };

  const sharePost = async (postId: string) => {
    const link = `${window.location.origin}/feed?post=${postId}`;
    await navigator.clipboard.writeText(link);
    toast.success("Post link copied");
    setOpenSharePostId(null);
  };

  const shareToPlatform = (postId: string, platform: "facebook" | "linkedin" | "x" | "whatsapp") => {
    const link = `${window.location.origin}/feed?post=${postId}`;
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
    const link = `${window.location.origin}/feed?post=${postId}`;
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

  if (!posts.length) {
    return <div className="card-panel text-sm text-slate-400">No public posts from this user yet.</div>;
  }

  return (
    <section className="space-y-4">
      {posts.map((post) => {
        const postBackgroundColor = normalizeHexColor(post.textStyle?.backgroundColor) ?? "#1e293b";
        const postTextColor = getReadableTextColor(postBackgroundColor);
        const myReaction = post.reactions.find((reaction) => reaction.user?._id === currentUserId)?.type;
        const reactionCounts = post.reactions.reduce<Record<string, number>>((acc, reaction) => {
          acc[reaction.type] = (acc[reaction.type] ?? 0) + 1;
          return acc;
        }, {});
        const topReactionTypes = Object.entries(reactionCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([type]) => type);

        return (
          <article key={post._id} className="card-panel">
            <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
              <p>{post.author.firstName} {post.author.lastName}</p>
              <p>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</p>
            </div>

            <div
              className="prose max-w-none rounded-xl px-4 py-3 shadow-inner **:text-inherit"
              style={{
                backgroundColor: postBackgroundColor,
                color: postTextColor,
                textAlign: post.textStyle?.textAlign ?? "left",
              }}
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {post.media?.length ? (
              <div className="mt-4 space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  {post.media
                    .filter((media) => media.type === "image")
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

                {post.media
                  .filter((media) => media.type === "pdf")
                  .map((media) => (
                    <a
                      key={media.url}
                      href={media.url}
                      target="_blank"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
                    >
                      <FileText className="h-4 w-4" />
                      {media.name ?? "PDF attachment"}
                    </a>
                  ))}
              </div>
            ) : null}

            {post.reactions.length ? (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
                <div className="flex items-center">
                  {topReactionTypes.map((type, index) => {
                    const option = reactionOptions.find((item) => item.type === type);
                    if (!option) return null;
                    const Icon = option.icon;

                    return (
                      <span
                        key={`${post._id}-summary-${type}`}
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-900 ${option.color} ${index > 0 ? "-ml-1" : ""}`}
                        title={option.label}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                    );
                  })}
                </div>
                <span>{post.reactions.length} reactions</span>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div
                className="relative"
                onMouseEnter={() => setOpenReactionPostId(post._id)}
                onMouseLeave={() => setOpenReactionPostId((prev) => (prev === post._id ? null : prev))}
              >
                <button className="icon-btn" type="button">
                  <Heart className="h-4 w-4" />
                  {myReaction ? `Reacted: ${myReaction}` : "React"}
                </button>
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
                            onClick={() => void reactToPost(post._id, item.type)}
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
                  onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [post._id]: event.target.value }))}
                  placeholder="Write a thoughtful comment"
                  rows={3}
                  className="w-full resize-y rounded-xl border border-slate-700/80 bg-slate-900/70 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-500"
                />
                <button className="icon-btn h-11" onClick={() => void commentOnPost(post._id)} type="button">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            {post.comments.length > 0 ? (
              <div className="mt-3 space-y-2">
                {post.comments.slice(-3).map((comment, index) => (
                  <p key={`${post._id}-comment-${index}`} className="text-sm text-slate-300">
                    <span className="font-semibold text-slate-200">{comment.user.firstName} {comment.user.lastName}</span> {comment.text}
                  </p>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}

      {openSharePostId && activeSharePost ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setOpenSharePostId(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Share Post</p>
                <h3 className="font-display text-2xl text-slate-100">Spread this thought</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenSharePostId(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                aria-label="Close share modal"
              >
                ×
              </button>
            </div>

            <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-3 text-sm text-slate-300">
              {activeSharePreview || "No preview text available."}
            </div>

            <div className="mt-3 rounded-xl border border-slate-700/80 bg-slate-950/40 p-3 text-xs text-cyan-200 break-all">
              {activeShareLink}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => void sharePost(openSharePostId)} className="icon-btn justify-center">
                <Copy className="h-4 w-4" />
                Copy link
              </button>
              <button type="button" onClick={() => void nativeSharePost(openSharePostId)} className="icon-btn justify-center">
                <Share2 className="h-4 w-4" />
                Native share
              </button>
              <button type="button" onClick={() => shareToPlatform(openSharePostId, "facebook")} className="icon-btn justify-center">
                Facebook
              </button>
              <button type="button" onClick={() => shareToPlatform(openSharePostId, "linkedin")} className="icon-btn justify-center">
                LinkedIn
              </button>
              <button type="button" onClick={() => shareToPlatform(openSharePostId, "x")} className="icon-btn justify-center">
                X
              </button>
              <button type="button" onClick={() => shareToPlatform(openSharePostId, "whatsapp")} className="icon-btn justify-center">
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
