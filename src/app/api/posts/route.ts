import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import Post from "@/models/Post";

const createPostSchema = z.object({
  content: z.string().max(20000).optional().default(""),
  media: z
    .array(
      z.object({
        url: z.string(),
        type: z.enum(["image", "pdf"]),
        width: z.number().optional(),
        height: z.number().optional(),
        name: z.string().optional(),
      })
    )
    .optional()
    .default([]),
});

export async function GET() {
  await connectDB();
  const posts = await Post.find({})
    .sort({ createdAt: -1 })
    .populate("author", "firstName lastName avatar")
    .populate("comments.user", "firstName lastName avatar")
    .populate("reactions.user", "firstName lastName avatar")
    .lean();

  return NextResponse.json({ posts });
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createPostSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await connectDB();

  const post = await Post.create({
    author: session.user.id,
    content: parsed.data.content,
    media: parsed.data.media,
  });

  await Notification.create({
    user: session.user.id,
    type: "system",
    title: "Post published",
    body: "Your thought has been shared to SoulSync feed.",
    link: "/feed",
  });

  return NextResponse.json({ post }, { status: 201 });
}
