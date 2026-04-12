"use client";

import { MoreVertical, Shield, Trash2, UserCog, Lock, Unlock, FileText } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";

type AdminStats = {
  totalUsers: number;
  totalPosts: number;
  blockedUsers: number;
  restrictedUsers: number;
  adminUsers: number;
};

type AdminUser = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "user" | "admin";
  isBlocked: boolean;
  blockedAt?: string | null;
  postRestrictionUntil?: string | null;
  createdAt: string;
};

type AdminPost = {
  _id: string;
  content: string;
  createdAt: string;
  author: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

type UserPost = {
  _id: string;
  content: string;
  createdAt: string;
  isHidden: boolean;
  media: { url: string; type: "image" | "pdf"; name?: string }[];
  reactionCount: number;
  commentCount: number;
};

type AdminOverviewResponse = {
  stats: AdminStats;
  users: AdminUser[];
  posts: AdminPost[];
};

type Props = {
  initialData: AdminOverviewResponse;
  currentAdminId: string;
};

const restrictionDurations = [
  { label: "24 hours", value: "24h" },
  { label: "3 days", value: "3d" },
  { label: "7 days", value: "7d" },
  { label: "1 month", value: "30d" },
] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function previewText(html: string) {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "(No content)";
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

export default function AdminDashboardClient({ initialData, currentAdminId }: Props) {
  const [data, setData] = useState(initialData);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [selectedUserInfo, setSelectedUserInfo] = useState<AdminUser | null>(null);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [userPostsLoading, setUserPostsLoading] = useState(false);
  const [selectedUserPosts, setSelectedUserPosts] = useState<AdminUser | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const refreshOverview = async () => {
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (!res.ok) return;
      const payload = (await res.json()) as AdminOverviewResponse;
      setData(payload);
    } catch (err) {
      console.error("Dashboard refresh error:", err);
    }
  };

  const loadUserPosts = async (userId: string) => {
    setUserPostsLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/posts`);
      if (!res.ok) {
        toast.error("Failed to load posts");
        return;
      }
      const payload = await res.json();
      setUserPosts(payload.posts ?? []);
      setSelectedUserPosts(data.users.find((u) => u._id === userId) ?? null);
    } catch {
      toast.error("Error loading posts");
    } finally {
      setUserPostsLoading(false);
    }
  };

  const updateUser = async (userId: string, body: Record<string, unknown>, successMessage: string) => {
    setLoadingKey(`user-${userId}`);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error ?? "Action failed");
        return;
      }

      toast.success(successMessage);
      setOpenMenuId(null);
      await refreshOverview();
    } catch {
      toast.error("Action failed");
    } finally {
      setLoadingKey(null);
    }
  };

  const removePost = async (postId: string) => {
    setLoadingKey(`post-${postId}`);
    try {
      const res = await fetch(`/api/admin/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error ?? "Delete failed");
        return;
      }
      toast.success("Post deleted");
      await loadUserPosts(selectedUserPosts?._id ?? "");
    } catch {
      toast.error("Delete failed");
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <section className="card-panel mb-6 overflow-hidden">
        <div className="relative">
          <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-cyan-500/20 blur-3xl" />
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-200">
            <Shield className="h-3.5 w-3.5" />
            Platform Control Center
          </p>
          <h1 className="mt-3 font-display text-3xl text-slate-100 md:text-4xl">Admin Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Comprehensive moderation and user management system for platform administrators.
          </p>
        </div>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <article className="card-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Users</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{data.stats.totalUsers}</p>
        </article>
        <article className="card-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Posts</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{data.stats.totalPosts}</p>
        </article>
        <article className="card-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Blocked</p>
          <p className="mt-2 text-2xl font-semibold text-rose-300">{data.stats.blockedUsers}</p>
        </article>
        <article className="card-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Restricted</p>
          <p className="mt-2 text-2xl font-semibold text-amber-300">{data.stats.restrictedUsers}</p>
        </article>
        <article className="card-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admins</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-300">{data.stats.adminUsers}</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <article className="card-panel">
          <div className="mb-4 flex items-center gap-2">
            <UserCog className="h-5 w-5 text-cyan-300" />
            <h2 className="font-display text-xl text-slate-100">User Management</h2>
          </div>

          <div className="hide-scrollbar max-h-[70vh] space-y-2 overflow-y-auto">
            {data.users.map((user) => {
              const isSelf = user._id === currentAdminId;
              const userBusy = loadingKey?.startsWith(`user-${user._id}`);

              return (
                <div key={user._id} className="group relative rounded-xl border border-slate-700/50 bg-slate-900/50 p-3 transition hover:border-slate-600 hover:bg-slate-900/70">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-100 truncate">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${user.role === "admin" ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200" : "border-slate-600 bg-slate-800 text-slate-200"}`} style={{ borderWidth: "1px" }}>
                          {user.role}
                        </span>
                        <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${user.isBlocked ? "border-rose-500/50 bg-rose-500/10 text-rose-200" : "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"}`} style={{ borderWidth: "1px" }}>
                          {user.isBlocked ? "Blocked" : "Active"}
                        </span>
                      </div>
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-700 bg-slate-900/80 p-2 text-slate-400 transition hover:bg-slate-800"
                        onClick={() => setOpenMenuId(openMenuId === user._id ? null : user._id)}
                        disabled={userBusy}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      <AnimatePresence>
                        {openMenuId === user._id && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute right-0 top-10 z-40 w-48 rounded-lg border border-slate-700 bg-slate-950 shadow-lg"
                          >
                            <button
                              type="button"
                              className="w-full px-4 py-2 text-left text-sm text-slate-300 transition hover:bg-slate-800"
                              onClick={() => {
                                setSelectedUserInfo(user);
                                setOpenMenuId(null);
                              }}
                            >
                              Info
                            </button>
                            <button
                              type="button"
                              className="w-full px-4 py-2 text-left text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                              onClick={() => {
                                loadUserPosts(user._id);
                                setOpenMenuId(null);
                              }}
                              disabled={userPostsLoading}
                            >
                              View Posts
                            </button>
                            <hr className="border-slate-700" />
                            <button
                              type="button"
                              className="w-full px-4 py-2 text-left text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                              onClick={() => void updateUser(user._id, { action: user.role === "admin" ? "setRole" : "setRole", role: user.role === "admin" ? "user" : "admin" }, user.role === "admin" ? "Demoted to user" : "Promoted to admin")}
                              disabled={isSelf || userBusy}
                            >
                              {user.role === "admin" ? "Demote to User" : "Promote to Admin"}
                            </button>
                            <button
                              type="button"
                              className="w-full px-4 py-2 text-left text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                              onClick={() => void updateUser(user._id, { action: user.isBlocked ? "unblock" : "block" }, user.isBlocked ? "Unblocked" : "Blocked")}
                              disabled={isSelf || userBusy}
                            >
                              {user.isBlocked ? <Unlock className="inline h-3.5 w-3.5 mr-1" /> : <Lock className="inline h-3.5 w-3.5 mr-1" />}
                              {user.isBlocked ? "Unblock" : "Block"}
                            </button>
                            <div className="border-t border-slate-700 p-2">
                              <p className="text-xs text-slate-500 mb-2 px-2">Restrict Posting</p>
                              {restrictionDurations.map((dur) => (
                                <button
                                  key={dur.value}
                                  type="button"
                                  className="w-full px-4 py-1.5 text-left text-xs text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                                  onClick={() => void updateUser(user._id, { action: "restrict", duration: dur.value }, `Restricted for ${dur.label}`)}
                                  disabled={isSelf || userBusy}
                                >
                                  {dur.label}
                                </button>
                              ))}
                            </div>
                            {user.postRestrictionUntil && (
                              <button
                                type="button"
                                className="w-full px-4 py-2 text-left text-xs text-slate-300 transition hover:bg-slate-800 disabled:opacity-50 border-t border-slate-700"
                                onClick={() => void updateUser(user._id, { action: "clearRestriction" }, "Restriction cleared")}
                                disabled={userBusy}
                              >
                                Clear Restriction
                              </button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="card-panel">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-300" />
            <h2 className="font-display text-xl text-slate-100">Recent Posts</h2>
          </div>

          <div className="hide-scrollbar max-h-[70vh] space-y-3 overflow-y-auto">
            {data.posts.map((post) => {
              const postBusy = loadingKey === `post-${post._id}`;
              return (
                <div key={post._id} className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
                  <p className="text-xs text-slate-400">
                    {post.author ? `${post.author.firstName} ${post.author.lastName}` : "Unknown"}{" "}
                    <span className="text-slate-500">({formatDate(post.createdAt)})</span>
                  </p>
                  <p className="mt-2 text-sm text-slate-300">{previewText(post.content)}</p>
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
                    disabled={postBusy}
                    onClick={() => void removePost(post._id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <AnimatePresence>
        {selectedUserInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onClick={() => setSelectedUserInfo(null)}
          >
            <motion.article
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card-panel max-w-md w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-display text-2xl text-slate-100 mb-4">
                {selectedUserInfo.firstName} {selectedUserInfo.lastName}
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="text-slate-100">{selectedUserInfo.email}</p>
                </div>
                <div>
                  <p className="text-slate-500">Role</p>
                  <p className="text-slate-100 capitalize">{selectedUserInfo.role}</p>
                </div>
                <div>
                  <p className="text-slate-500">Account Status</p>
                  <p className={selectedUserInfo.isBlocked ? "text-rose-300" : "text-emerald-300"}>{selectedUserInfo.isBlocked ? "Blocked" : "Active"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Joined</p>
                  <p className="text-slate-100">{formatDate(selectedUserInfo.createdAt)}</p>
                </div>
                {selectedUserInfo.blockedAt && (
                  <div>
                    <p className="text-slate-500">Blocked At</p>
                    <p className="text-slate-100">{formatDate(selectedUserInfo.blockedAt)}</p>
                  </div>
                )}
                {selectedUserInfo.postRestrictionUntil && (
                  <div>
                    <p className="text-slate-500">Posting Restricted Until</p>
                    <p className="text-slate-100">{formatDate(selectedUserInfo.postRestrictionUntil)}</p>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="mt-6 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-200 transition hover:bg-slate-800"
                onClick={() => setSelectedUserInfo(null)}
              >
                Close
              </button>
            </motion.article>
          </motion.div>
        )}

        {selectedUserPosts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onClick={() => setSelectedUserPosts(null)}
          >
            <motion.article
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card-panel max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-display text-2xl text-slate-100 mb-4">
                Posts by {selectedUserPosts.firstName} {selectedUserPosts.lastName}
              </h2>
              {userPostsLoading ? (
                <p className="text-slate-400">Loading posts...</p>
              ) : userPosts.length === 0 ? (
                <p className="text-slate-400">No posts found</p>
              ) : (
                <div className="space-y-3">
                  {userPosts.map((post) => {
                    const postBusy = loadingKey === `post-${post._id}`;
                    return (
                      <div key={post._id} className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-500">{formatDate(post.createdAt)}</p>
                            <span className={`inline-block mt-1 rounded px-2 py-0.5 text-[11px] border ${post.isHidden ? "border-amber-500/50 bg-amber-500/10 text-amber-200" : "border-slate-600 bg-slate-800 text-slate-200"}`}>
                              {post.isHidden ? "Hidden" : "Visible"}
                            </span>
                          </div>
                          <div className="text-right text-xs text-slate-400">
                            <p>{post.reactionCount} reactions</p>
                            <p>{post.commentCount} comments</p>
                          </div>
                        </div>
                        <p className="text-sm text-slate-300 line-clamp-3">{previewText(post.content)}</p>
                        <button
                          type="button"
                          className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
                          disabled={postBusy}
                          onClick={() => void removePost(post._id)}
                        >
                          <Trash2 className="inline h-3.5 w-3.5 mr-1" />
                          Delete Post
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                className="mt-6 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-200 transition hover:bg-slate-800"
                onClick={() => setSelectedUserPosts(null)}
              >
                Close
              </button>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
