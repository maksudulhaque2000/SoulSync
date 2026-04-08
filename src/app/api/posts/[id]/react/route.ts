import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import Post from "@/models/Post";

export const runtime = "nodejs";
const reactSchema = z.object({
  type: z.enum(["love", "care", "celebrate", "insightful", "support"]),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = reactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
  }

  await connectDB();
  const post = await Post.findById(id);
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.isHidden && post.author.toString() !== session.user.id) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const existingIndex = post.reactions.findIndex(
    (r: { user: { toString: () => string }; type: string }) => r.user.toString() === session.user.id
  );

  if (existingIndex >= 0 && post.reactions[existingIndex].type === parsed.data.type) {
    post.reactions.splice(existingIndex, 1);
  } else if (existingIndex >= 0) {
    post.reactions[existingIndex].type = parsed.data.type;
  } else {
    post.reactions.push({ user: session.user.id, type: parsed.data.type });
    if (post.author.toString() !== session.user.id) {
      await Notification.create({
        user: post.author,
        type: "post_reaction",
        title: "New reaction",
        body: `${session.user.firstName} reacted to your post with ${parsed.data.type}.`,
        link: `/?post=${id}`,
      });
    }
  }

  await post.save();

  return NextResponse.json({ success: true, reactions: post.reactions });
}
