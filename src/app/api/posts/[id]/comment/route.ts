import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import Post from "@/models/Post";

export const runtime = "nodejs";
const commentSchema = z.object({
  text: z.string().min(1).max(1000),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = commentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
  }

  await connectDB();
  const post = await Post.findById(id);
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.isHidden && post.author.toString() !== session.user.id) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  post.comments.push({ user: session.user.id, text: parsed.data.text });
  await post.save();

  if (post.author.toString() !== session.user.id) {
    await Notification.create({
      user: post.author,
      type: "post_comment",
      title: "New comment",
      body: `${session.user.firstName} commented on your post.`,
      link: `/?post=${id}`,
    });
  }

  return NextResponse.json({ success: true });
}
