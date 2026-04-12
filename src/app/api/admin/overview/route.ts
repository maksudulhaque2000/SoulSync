import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";
import Post from "@/models/Post";
import User from "@/models/User";

export const runtime = "nodejs";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();

  const [totalUsers, totalPosts, blockedUsers, restrictedUsers, adminUsers, messageCount, usersRaw, postsRaw] = await Promise.all([
    User.countDocuments({}),
    Post.countDocuments({}),
    User.countDocuments({ isBlocked: true }),
    User.countDocuments({ postRestrictionUntil: { $gt: new Date() } }),
    User.countDocuments({ role: "admin" }),
    Message.countDocuments(),
    User.find()
      .select("firstName lastName email avatar role isBlocked blockedAt blockReason postRestrictionUntil postRestrictionReason createdAt")
      .sort({ createdAt: -1 })
      .limit(40)
      .lean(),
    Post.find()
      .select("content isHidden createdAt author comments reactions")
      .sort({ createdAt: -1 })
      .limit(40)
      .populate("author", "firstName lastName email avatar")
      .lean(),
  ]);

  return NextResponse.json({
    stats: {
      totalUsers,
      totalPosts,
      blockedUsers,
      restrictedUsers,
      adminUsers,
      messageCount,
    },
    users: usersRaw,
    posts: postsRaw,
  });
}
