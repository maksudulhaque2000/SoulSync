import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import User from "@/models/User";

export const runtime = "nodejs";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const me = await User.findById(session.user.id)
    .select("role")
    .lean();

  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  return NextResponse.json({
    stats: {
      totalUsers,
      totalPosts,
      blockedUsers,
      restrictedUsers,
      adminUsers,
    },
    users,
    posts,
  });
}
