"use client";

import { Ban, Clock3, Eye, EyeOff, MoreHorizontal, RefreshCw, Shield, ShieldOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { FancyDialog } from "@/components/fancy-dialog";

type AdminStats = {
  totalUsers: number;
  totalPosts: number;
  blockedUsers: number;
  restrictedUsers: number;
  adminUsers: number;
  messageCount: number;
};

type AdminUser = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  role?: "user" | "admin";
  isBlocked?: boolean;
  blockedAt?: string | null;
  blockReason?: string;
  postRestrictionUntil?: string | null;
  postRestrictionReason?: string;
  createdAt: string;
};

type AdminPost = {
  _id: string;
  content?: string;
  isHidden?: boolean;
  createdAt: string;
  commentCount?: number;
  reactionCount?: number;
  author?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
  };
  comments?: Array<unknown>;
  reactions?: Array<unknown>;
};

type UserPost = {
  _id: string;
  content: string;
  createdAt: string;
  isHidden: boolean;
  reactionCount: number;
  commentCount: number;
};

type OverviewPayload = {
  stats: AdminStats;
  users: AdminUser[];
  posts: AdminPost[];
};

type PendingDeleteUser = {
  id: string;
  name: string;
};

type PendingDeletePost = {
  id: string;
  authorName: string;
};

function htmlToText(html: string | undefined) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

const menuActionClass =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800 disabled:opacity-50";

export default function AdminDashboardClient({ currentUserId }: { currentUserId: string }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingUserId, setWorkingUserId] = useState<string | null>(null);
  const [workingPostId, setWorkingPostId] = useState<string | null>(null);
  const [openUserMenuId, setOpenUserMenuId] = useState<string | null>(null);
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null);
  const [selectedUserPostsId, setSelectedUserPostsId] = useState<string | null>(null);
  const [selectedUserPostsName, setSelectedUserPostsName] = useState("");
  const [selectedUserPostsEmail, setSelectedUserPostsEmail] = useState("");
  const [userPostsLoading, setUserPostsLoading] = useState(false);
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalPosts: 0,
    blockedUsers: 0,
    restrictedUsers: 0,
    adminUsers: 0,
    messageCount: 0,
  });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [blockDialogUser, setBlockDialogUser] = useState<AdminUser | null>(null);
  const [blockReason, setBlockReason] = useState("Blocked by admin");
  const [restrictionDialogUser, setRestrictionDialogUser] = useState<AdminUser | null>(null);
  const [restrictionDuration, setRestrictionDuration] = useState("24h");
  const [restrictionReason, setRestrictionReason] = useState("Posting restricted by admin");
  const [pendingDeleteUser, setPendingDeleteUser] = useState<PendingDeleteUser | null>(null);
  const [pendingDeletePost, setPendingDeletePost] = useState<PendingDeletePost | null>(null);

  const loadOverview = async (showRefreshState = false) => {
    if (showRefreshState) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load dashboard data");
      }

      const payload = data as OverviewPayload;
      setStats(payload.stats);
      setUsers(payload.users ?? []);
      setPosts(payload.posts ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load dashboard data";
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenUserMenuId(null);
      setOpenPostMenuId(null);
    };

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-admin-menu-root='true']")) {
        setOpenUserMenuId(null);
        setOpenPostMenuId(null);
      }
    };

    document.addEventListener("keydown", onEscape);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return users;

    return users.filter((user) => {
      const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.toLowerCase();
      const email = (user.email ?? "").toLowerCase();
      return name.includes(keyword) || email.includes(keyword);
    });
  }, [query, users]);

  const filteredPosts = useMemo(() => {
    const sourcePosts: AdminPost[] = selectedUserPostsId
      ? userPosts.map((post) => ({
          _id: post._id,
          content: post.content,
          isHidden: post.isHidden,
          createdAt: post.createdAt,
          commentCount: post.commentCount,
          reactionCount: post.reactionCount,
          author: {
            _id: selectedUserPostsId,
            firstName: selectedUserPostsName.split(" ")[0] ?? "",
            lastName: selectedUserPostsName.split(" ").slice(1).join(" "),
            email: selectedUserPostsEmail,
          },
        }))
      : posts;

    const keyword = query.trim().toLowerCase();
    if (!keyword) return sourcePosts;

    return sourcePosts.filter((post) => {
      const author = `${post.author?.firstName ?? ""} ${post.author?.lastName ?? ""}`.toLowerCase();
      const text = htmlToText(post.content).toLowerCase();
      return author.includes(keyword) || text.includes(keyword);
    });
  }, [posts, query, selectedUserPostsEmail, selectedUserPostsId, selectedUserPostsName, userPosts]);

  const reloadPostsForSelectedUser = async (userId: string) => {
    setUserPostsLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/posts`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load user posts");
      }
      setUserPosts(data.posts ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load user posts";
      toast.error(message);
    } finally {
      setUserPostsLoading(false);
    }
  };

  const openUserPosts = async (user: AdminUser) => {
    setSelectedUserPostsId(user._id);
    setSelectedUserPostsName(`${user.firstName} ${user.lastName}`.trim());
    setSelectedUserPostsEmail(user.email ?? "");
    await reloadPostsForSelectedUser(user._id);
  };

  const clearSelectedUserPosts = () => {
    setSelectedUserPostsId(null);
    setSelectedUserPostsName("");
    setSelectedUserPostsEmail("");
    setUserPosts([]);
    setOpenPostMenuId(null);
  };

  const updateUserAction = async (
    userId: string,
    payload: Record<string, unknown>,
    successMessage: string
  ) => {
    setWorkingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update role");
      }

      if (data.user) {
        setUsers((prev) => prev.map((item) => (item._id === userId ? { ...item, ...data.user } : item)));
      }

      await loadOverview(true);

      toast.success(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update user";
      toast.error(message);
    } finally {
      setWorkingUserId(null);
    }
  };

  const updateRole = async (userId: string, role: "user" | "admin") => {
    await updateUserAction(userId, { action: "setRole", role }, "User role updated");
  };

  const toggleUserBlock = async (user: AdminUser) => {
    if (user.isBlocked) {
      await updateUserAction(user._id, { action: "unblock" }, "User unblocked");
      return;
    }

    setOpenUserMenuId(null);
    setBlockDialogUser(user);
    setBlockReason("Blocked by admin");
  };

  const applyRestriction = async (user: AdminUser) => {
    setOpenUserMenuId(null);
    setRestrictionDialogUser(user);
    setRestrictionDuration("24h");
    setRestrictionReason("Posting restricted by admin");
  };

  const clearRestriction = async (userId: string) => {
    await updateUserAction(userId, { action: "clearRestriction" }, "Posting restriction cleared");
  };

  const deleteUser = async (userId: string) => {
    setWorkingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete user");
      }

      setUsers((prev) => prev.filter((item) => item._id !== userId));
      setStats((prev) => ({
        ...prev,
        totalUsers: Math.max(0, prev.totalUsers - 1),
        adminUsers: Math.max(0, prev.adminUsers - (data.deletedRole === "admin" ? 1 : 0)),
      }));
      setPosts((prev) => prev.filter((item) => item.author?._id !== userId));
      setOpenUserMenuId(null);
      if (selectedUserPostsId === userId) {
        clearSelectedUserPosts();
      }
      await loadOverview(true);
      toast.success("User deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete user";
      toast.error(message);
    } finally {
      setWorkingUserId(null);
    }
  };

  const togglePostVisibility = async (postId: string, currentHidden: boolean) => {
    setWorkingPostId(postId);
    try {
      const res = await fetch(`/api/admin/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: !currentHidden }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update post visibility");
      }

      setPosts((prev) => prev.map((item) => (item._id === postId ? { ...item, isHidden: !currentHidden } : item)));
      setUserPosts((prev) => prev.map((item) => (item._id === postId ? { ...item, isHidden: !currentHidden } : item)));
      toast.success(!currentHidden ? "Post hidden" : "Post unhidden");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update post visibility";
      toast.error(message);
    } finally {
      setWorkingPostId(null);
    }
  };

  const deletePost = async (postId: string) => {
    setWorkingPostId(postId);
    try {
      const res = await fetch(`/api/admin/posts/${postId}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete post");
      }

      setPosts((prev) => prev.filter((item) => item._id !== postId));
      setUserPosts((prev) => prev.filter((item) => item._id !== postId));
      setStats((prev) => ({ ...prev, totalPosts: Math.max(0, prev.totalPosts - 1) }));
      setOpenPostMenuId(null);
      await loadOverview(true);
      toast.success("Post deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete post";
      toast.error(message);
    } finally {
      setWorkingPostId(null);
    }
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="card-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Admin Console</p>
            <h1 className="mt-2 font-display text-3xl text-slate-100">Dashboard Control</h1>
            <p className="mt-2 text-sm text-slate-400">Users, posts এবং system activity এখান থেকে manage করুন।</p>
          </div>

          <button
            className="icon-btn"
            type="button"
            onClick={() => void loadOverview(true)}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`h-4 w-4 ${(refreshing || loading) ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Users</p>
            <p className="mt-2 text-2xl font-semibold text-slate-100">{stats.totalUsers}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Posts</p>
            <p className="mt-2 text-2xl font-semibold text-slate-100">{stats.totalPosts}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Messages</p>
            <p className="mt-2 text-2xl font-semibold text-slate-100">{stats.messageCount}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Blocked Users</p>
            <p className="mt-2 text-2xl font-semibold text-rose-300">{stats.blockedUsers}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Restricted</p>
            <p className="mt-2 text-2xl font-semibold text-amber-300">{stats.restrictedUsers}</p>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Admins</p>
            <p className="mt-2 text-2xl font-semibold text-cyan-300">{stats.adminUsers}</p>
          </div>
        </div>

        <div className="mt-5">
          <input
            className="auth-input h-11"
            placeholder="Search users/posts by name, email or post text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="card-panel">
          <h2 className="font-display text-2xl text-slate-100">Manage Users</h2>
          <p className="mt-1 text-sm text-slate-400">Role change, account cleanup এবং access control।</p>

          <div className="mt-4 space-y-3">
            {loading ? <p className="text-sm text-slate-400">Loading users...</p> : null}
            {!loading && !filteredUsers.length ? <p className="text-sm text-slate-400">No users found.</p> : null}

            {filteredUsers.map((user) => {
              const isSelf = user._id === currentUserId;
              const isBusy = workingUserId === user._id;

              return (
                <div
                  key={user._id}
                  className="rounded-xl border border-slate-700/70 bg-slate-900/35 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-100">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-slate-400">{user.email}</p>
                      <button
                        className="mt-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-200 transition hover:bg-cyan-500/20"
                        type="button"
                        onClick={() => void openUserPosts(user)}
                      >
                        ID: {user._id}
                      </button>
                      <p className="mt-1 text-xs text-slate-500">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                      <p className="mt-1 text-xs text-slate-500">Blocked at: {formatDateTime(user.blockedAt)}</p>
                      <p className="text-xs text-slate-500">Restriction until: {formatDateTime(user.postRestrictionUntil)}</p>
                      <Link
                        href={`/profile/${user._id}`}
                        className="mt-2 inline-flex items-center rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 transition hover:bg-slate-800"
                      >
                        Visit Profile
                      </Link>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className={`rounded-full border px-2 py-1 text-xs ${user.role === "admin" ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200" : "border-slate-600 bg-slate-800 text-slate-300"}`}>
                        {user.role === "admin" ? "Admin" : "User"}
                      </span>
                      <span className={`rounded-full border px-2 py-1 text-xs ${user.isBlocked ? "border-rose-500/50 bg-rose-500/10 text-rose-200" : "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"}`}>
                        {user.isBlocked ? "Blocked" : "Active"}
                      </span>

                      <div className="relative" data-admin-menu-root="true">
                        <button
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/70 text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setOpenUserMenuId((prev) => (prev === user._id ? null : user._id));
                            setOpenPostMenuId(null);
                          }}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {openUserMenuId === user._id ? (
                          <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-slate-700/80 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-xl">
                            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Account</p>
                            <button
                              className={menuActionClass}
                              type="button"
                              disabled={isBusy || user.role === "admin"}
                              onClick={() => void updateRole(user._id, "admin")}
                            >
                              <Shield className="h-4 w-4" />
                              Make Admin
                            </button>

                            <button
                              className={menuActionClass}
                              type="button"
                              disabled={isBusy || user.role !== "admin" || isSelf}
                              onClick={() => void updateRole(user._id, "user")}
                            >
                              <ShieldOff className="h-4 w-4" />
                              Remove Admin
                            </button>

                            <div className="my-1 h-px bg-slate-800" />
                            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Moderation</p>

                            <button
                              className={menuActionClass}
                              type="button"
                              disabled={isBusy || isSelf}
                              onClick={() => void toggleUserBlock(user)}
                            >
                              <Ban className="h-4 w-4" />
                              {user.isBlocked ? "Unblock User" : "Block User"}
                            </button>

                            <button
                              className={menuActionClass}
                              type="button"
                              disabled={isBusy || isSelf || user.isBlocked}
                              onClick={() => void applyRestriction(user)}
                            >
                              <Clock3 className="h-4 w-4" />
                              Restrict Posting
                            </button>

                            <button
                              className={menuActionClass}
                              type="button"
                              disabled={isBusy || isSelf || !user.postRestrictionUntil}
                              onClick={() => void clearRestriction(user._id)}
                            >
                              Clear Restriction
                            </button>

                            <button
                              className={menuActionClass}
                              type="button"
                              disabled={isBusy}
                              onClick={() => void openUserPosts(user)}
                            >
                              <Eye className="h-4 w-4" />
                              View User Posts
                            </button>

                            <div className="my-1 h-px bg-slate-800" />
                            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-300/70">Danger Zone</p>

                            <button
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-200 transition hover:bg-rose-900/20 disabled:opacity-50"
                              type="button"
                              disabled={isBusy || isSelf}
                              onClick={() => {
                                setOpenUserMenuId(null);
                                setPendingDeleteUser({
                                  id: user._id,
                                  name: `${user.firstName} ${user.lastName}`.trim(),
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete User
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card-panel">
          <h2 className="font-display text-2xl text-slate-100">Moderate Posts</h2>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-400">
              {selectedUserPostsId
                ? `${selectedUserPostsName} এর posts দেখানো হচ্ছে. Hide/Unhide বা delete করতে পারবেন.`
                : "Hide/Unhide বা permanent delete করে feed control করুন।"}
            </p>
            {selectedUserPostsId ? (
              <button className="icon-btn" type="button" onClick={clearSelectedUserPosts}>
                Show All Posts
              </button>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {loading || (selectedUserPostsId && userPostsLoading) ? (
              <p className="text-sm text-slate-400">Loading posts...</p>
            ) : null}
            {!loading && !filteredPosts.length ? <p className="text-sm text-slate-400">No posts found.</p> : null}

            {filteredPosts.map((post) => {
              const isBusy = workingPostId === post._id;
              const postText = htmlToText(post.content);

              return (
                <div
                  key={post._id}
                  className="rounded-xl border border-slate-700/70 bg-slate-900/35 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-100">
                        {post.author?.firstName} {post.author?.lastName}
                      </p>
                      <p className="text-xs text-slate-400">{post.author?.email || "Unknown email"}</p>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-300">
                        {postText || "(No text content)"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(post.createdAt).toLocaleString()} • {post.commentCount ?? post.comments?.length ?? 0} comments • {post.reactionCount ?? post.reactions?.length ?? 0} reactions
                      </p>
                    </div>

                    <span className={`rounded-full border px-2 py-1 text-xs ${post.isHidden ? "border-amber-500/50 bg-amber-500/10 text-amber-200" : "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"}`}>
                      {post.isHidden ? "Hidden" : "Visible"}
                    </span>
                  </div>

                    <div className="relative mt-3 flex justify-end" data-admin-menu-root="true">
                      <button
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/70 text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setOpenPostMenuId((prev) => (prev === post._id ? null : post._id));
                          setOpenUserMenuId(null);
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {openPostMenuId === post._id ? (
                        <div className="absolute right-0 z-30 mt-10 w-44 rounded-xl border border-slate-700/80 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-xl">
                          <button
                            className={menuActionClass}
                            type="button"
                            disabled={isBusy}
                            onClick={() => void togglePostVisibility(post._id, Boolean(post.isHidden))}
                          >
                            {post.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            {post.isHidden ? "Unhide Post" : "Hide Post"}
                          </button>

                          <div className="my-1 h-px bg-slate-800" />

                          <button
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-200 transition hover:bg-rose-900/20 disabled:opacity-50"
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setOpenPostMenuId(null);
                              setPendingDeletePost({
                                id: post._id,
                                authorName: `${post.author?.firstName ?? "Unknown"} ${post.author?.lastName ?? "User"}`.trim(),
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Post
                          </button>
                        </div>
                      ) : null}
                    </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <FancyDialog
        open={Boolean(blockDialogUser)}
        onClose={() => setBlockDialogUser(null)}
        title="Block User"
        description={blockDialogUser ? `Set an optional reason before blocking ${blockDialogUser.firstName} ${blockDialogUser.lastName}.` : ""}
        actions={[
          {
            label: "Cancel",
            onClick: () => setBlockDialogUser(null),
          },
          {
            label: "Block User",
            variant: "danger",
            disabled: Boolean(blockDialogUser && workingUserId === blockDialogUser._id),
            onClick: async () => {
              if (!blockDialogUser) return;
              await updateUserAction(
                blockDialogUser._id,
                { action: "block", reason: blockReason.trim() || "Blocked by admin" },
                "User blocked"
              );
              setBlockDialogUser(null);
            },
          },
        ]}
      >
        <label className="text-sm text-slate-300">
          Block reason
          <textarea
            rows={3}
            value={blockReason}
            onChange={(event) => setBlockReason(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700/80 bg-slate-900/70 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-500"
            placeholder="Blocked by admin"
          />
        </label>
      </FancyDialog>

      <FancyDialog
        open={Boolean(restrictionDialogUser)}
        onClose={() => setRestrictionDialogUser(null)}
        title="Restrict Posting"
        description={restrictionDialogUser ? `Apply posting restriction to ${restrictionDialogUser.firstName} ${restrictionDialogUser.lastName}.` : ""}
        actions={[
          {
            label: "Cancel",
            onClick: () => setRestrictionDialogUser(null),
          },
          {
            label: "Apply Restriction",
            variant: "primary",
            disabled: Boolean(restrictionDialogUser && workingUserId === restrictionDialogUser._id),
            onClick: async () => {
              if (!restrictionDialogUser) return;
              await updateUserAction(
                restrictionDialogUser._id,
                {
                  action: "restrict",
                  duration: restrictionDuration,
                  reason: restrictionReason.trim() || "Posting restricted by admin",
                },
                "Posting restriction applied"
              );
              setRestrictionDialogUser(null);
            },
          },
        ]}
      >
        <label className="text-sm text-slate-300">
          Duration
          <select
            value={restrictionDuration}
            onChange={(event) => setRestrictionDuration(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700/80 bg-slate-900/70 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-500"
          >
            <option value="24h">24 hours</option>
            <option value="3d">3 days</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
          </select>
        </label>

        <label className="mt-3 block text-sm text-slate-300">
          Restriction reason
          <textarea
            rows={3}
            value={restrictionReason}
            onChange={(event) => setRestrictionReason(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700/80 bg-slate-900/70 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-500"
            placeholder="Posting restricted by admin"
          />
        </label>
      </FancyDialog>

      <FancyDialog
        open={Boolean(pendingDeleteUser)}
        onClose={() => setPendingDeleteUser(null)}
        title="Delete User"
        description={pendingDeleteUser ? `${pendingDeleteUser.name} and related data will be deleted permanently.` : ""}
        actions={[
          {
            label: "Cancel",
            onClick: () => setPendingDeleteUser(null),
          },
          {
            label: "Delete Permanently",
            variant: "danger",
            disabled: Boolean(pendingDeleteUser && workingUserId === pendingDeleteUser.id),
            onClick: async () => {
              if (!pendingDeleteUser) return;
              await deleteUser(pendingDeleteUser.id);
              setPendingDeleteUser(null);
            },
          },
        ]}
      />

      <FancyDialog
        open={Boolean(pendingDeletePost)}
        onClose={() => setPendingDeletePost(null)}
        title="Delete Post"
        description={pendingDeletePost ? `Delete selected post by ${pendingDeletePost.authorName}? This cannot be undone.` : ""}
        actions={[
          {
            label: "Cancel",
            onClick: () => setPendingDeletePost(null),
          },
          {
            label: "Delete Permanently",
            variant: "danger",
            disabled: Boolean(pendingDeletePost && workingPostId === pendingDeletePost.id),
            onClick: async () => {
              if (!pendingDeletePost) return;
              await deletePost(pendingDeletePost.id);
              setPendingDeletePost(null);
            },
          },
        ]}
      />

    </section>
  );
}
