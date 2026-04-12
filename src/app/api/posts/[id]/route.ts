import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import User from "@/models/User";

export const runtime = "nodejs";
const mediaSchema = z.object({
  url: z.string(),
  type: z.enum(["image", "pdf"]),
  width: z.number().optional(),
  height: z.number().optional(),
  name: z.string().optional(),
});

const updatePostSchema = z.object({
  content: z.string().max(20000).optional(),
  textStyle: z
    .object({
      backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      textAlign: z.enum(["left", "center", "right"]).optional(),
    })
    .optional(),
  media: z.array(mediaSchema).optional(),
  isHidden: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updatePostSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await connectDB();
  const post = await Post.findById(id);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.author.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = parsed.data;

  if (typeof payload.content === "string") {
    post.content = payload.content;
  }

  if (payload.textStyle) {
    if (payload.textStyle.backgroundColor) {
      post.textStyle.backgroundColor = payload.textStyle.backgroundColor;
    }
    if (payload.textStyle.textAlign) {
      post.textStyle.textAlign = payload.textStyle.textAlign;
    }
  }

  if (Array.isArray(payload.media)) {
    post.media = payload.media;
  }

  if (typeof payload.isHidden === "boolean") {
    post.isHidden = payload.isHidden;
  }

  await post.save();

  const populatedPost = await Post.findById(id)
    .populate("author", "firstName lastName avatar")
    .populate("comments.user", "firstName lastName avatar")
    .populate("reactions.user", "firstName lastName avatar")
    .lean();

  return NextResponse.json({ post: populatedPost });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const me = await User.findById(session.user.id)
    .select("role")
    .lean();

  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const post = await Post.findById(id);
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.author.toString() !== session.user.id && me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await Post.findByIdAndDelete(id);

  return NextResponse.json({ success: true });
}
