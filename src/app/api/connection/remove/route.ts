import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs";

const removeSchema = z.object({
  targetUserId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = removeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (parsed.data.targetUserId === session.user.id) {
    return NextResponse.json({ error: "Invalid target user" }, { status: 400 });
  }

  await connectDB();

  const me = await User.findById(session.user.id);
  const target = await User.findById(parsed.data.targetUserId);

  if (!me || !target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  me.connections = me.connections.filter(
    (id: { toString: () => string }) => id.toString() !== target._id.toString()
  );
  target.connections = target.connections.filter(
    (id: { toString: () => string }) => id.toString() !== me._id.toString()
  );

  me.pendingSent = me.pendingSent.filter(
    (id: { toString: () => string }) => id.toString() !== target._id.toString()
  );
  me.pendingReceived = me.pendingReceived.filter(
    (id: { toString: () => string }) => id.toString() !== target._id.toString()
  );
  target.pendingSent = target.pendingSent.filter(
    (id: { toString: () => string }) => id.toString() !== me._id.toString()
  );
  target.pendingReceived = target.pendingReceived.filter(
    (id: { toString: () => string }) => id.toString() !== me._id.toString()
  );

  await me.save();
  await target.save();

  return NextResponse.json({ success: true });
}