import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import User from "@/models/User";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;

  const postsRaw = await Post.find({ author: id })
    .select("_id author content createdAt isHidden media reactions comments")
    .sort({ createdAt: -1 })
    .populate("author", "firstName lastName email")
    .populate("comments.user", "firstName lastName")
    .populate("reactions.user", "_id")
    .lean();

  const posts = postsRaw.map((post) => ({
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
    content: post.content,
    createdAt: post.createdAt,
    isHidden: post.isHidden ?? false,
    media: post.media ?? [],
    reactionCount: post.reactions?.length ?? 0,
    commentCount: post.comments?.length ?? 0,
  }));

  return NextResponse.json({ posts });
}
