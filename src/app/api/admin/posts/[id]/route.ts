import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i),
});

const patchSchema = z.object({
  isHidden: z.boolean(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  const body = await req.json();
  const parsedBody = patchSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await connectDB();

  const post = await Post.findByIdAndUpdate(
    parsedParams.data.id,
    { isHidden: parsedBody.data.isHidden },
    { new: true }
  )
    .populate("author", "firstName lastName email avatar")
    .lean();

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({ post });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  await connectDB();
  const deleted = await Post.findByIdAndDelete(parsedParams.data.id).lean();

  if (!deleted) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
