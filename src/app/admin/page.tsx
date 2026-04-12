import { redirect } from "next/navigation";

import AdminDashboardClient from "@/components/admin-dashboard-client";
import TopNav from "@/components/top-nav";
import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import User from "@/models/User";

export default async function AdminPage() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect("/");
  }

  if (session.user.role !== "admin") {
    redirect("/feed");
  }

  await connectDB();

  const me = await User.findById(session.user.id)
    .select("role")
    .lean();

  if (!me || me.role !== "admin") {
    redirect("/feed");
  }

  const [
    totalUsers,
    totalPosts,
    blockedUsers,
    restrictedUsers,
    adminUsers,
    usersRaw,
    postsRaw,
  ] = await Promise.all([
    User.countDocuments({}),
    Post.countDocuments({}),
    User.countDocuments({ isBlocked: true }),
    User.countDocuments({ postRestrictionUntil: { $gt: new Date() } }),
    User.countDocuments({ role: "admin" }),
    User.find({})
      .select("firstName lastName email role isBlocked blockedAt postRestrictionUntil createdAt")
      .sort({ createdAt: -1 })
      .lean(),
    Post.find({})
      .select("author content createdAt")
      .sort({ createdAt: -1 })
      .limit(40)
      .populate("author", "firstName lastName email")
      .lean(),
  ]);

  const users = usersRaw.map((user) => ({
    ...user,
    _id: user._id.toString(),
  }));

  const posts = postsRaw.map((post) => ({
    ...post,
    _id: post._id.toString(),
    author:
      post.author && typeof post.author === "object"
        ? {
            _id: post.author._id?.toString?.() ?? "",
            firstName: post.author.firstName,
            lastName: post.author.lastName,
            email: post.author.email,
          }
        : null,
  }));

  const initialData = {
    stats: {
      totalUsers,
      totalPosts,
      blockedUsers,
      restrictedUsers,
      adminUsers,
    },
    users,
    posts,
  };

  return (
    <main className="min-h-svh bg-site-gradient pb-8">
      <TopNav fullName={`${session.user.firstName} ${session.user.lastName}`} isAdmin />
      <AdminDashboardClient initialData={initialData} currentAdminId={session.user.id} />
    </main>
  );
}
