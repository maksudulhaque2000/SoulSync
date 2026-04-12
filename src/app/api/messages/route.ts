import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";

export const runtime = "nodejs";

const postMessageSchema = z.object({
  to: z.string().min(1),
  text: z.string().max(1000).optional().default(""),
  voiceUrl: z.string().optional().default(""),
});

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    const unread = await Message.countDocuments({ to: session.user.id, read: false });
    return NextResponse.json({ unread });
  }

  const messages = await Message.find({
    $or: [
      { from: session.user.id, to: userId },
      { from: userId, to: session.user.id },
    ],
  })
    .sort({ createdAt: 1 })
    .populate("from", "firstName lastName avatar")
    .populate("to", "firstName lastName avatar")
    .lean();

  await Message.updateMany({ from: userId, to: session.user.id, read: false }, { $set: { read: true } });

  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = postMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  if (!parsed.data.text && !parsed.data.voiceUrl) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  await connectDB();

  const message = await Message.create({
    from: session.user.id,
    to: parsed.data.to,
    text: parsed.data.text,
    voiceUrl: parsed.data.voiceUrl,
  });

  return NextResponse.json({ message }, { status: 201 });
}
