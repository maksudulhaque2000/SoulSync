import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import User from "@/models/User";

export const runtime = "nodejs";

const requestSchema = z.object({
  targetUserId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (parsed.data.targetUserId === session.user.id) {
    return NextResponse.json({ error: "Cannot connect to yourself" }, { status: 400 });
  }

  await connectDB();

  const me = await User.findById(session.user.id);
  const target = await User.findById(parsed.data.targetUserId);

  if (!me || !target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const iBlockedTarget = me.blockedUsers.some(
    (id: { toString: () => string }) => id.toString() === target._id.toString()
  );
  const targetBlockedMe = target.blockedUsers.some(
    (id: { toString: () => string }) => id.toString() === me._id.toString()
  );
  if (iBlockedTarget || targetBlockedMe) {
    return NextResponse.json({ error: "Connection is unavailable for this user" }, { status: 403 });
  }

  const alreadyConnected = me.connections.some((id: { toString: () => string }) => id.toString() === target._id.toString());
  if (alreadyConnected) {
    return NextResponse.json({ error: "Already connected" }, { status: 409 });
  }

  const alreadySent = me.pendingSent.some((id: { toString: () => string }) => id.toString() === target._id.toString());
  if (!alreadySent) {
    me.pendingSent.push(target._id);
    target.pendingReceived.push(me._id);
    await me.save();
    await target.save();

    await Notification.create({
      user: target._id,
      type: "connection_request",
      title: "New connection request",
      body: `${session.user.firstName} sent you a connection request.`,
      link: `/profile?requesterId=${session.user.id}`,
      meta: { from: session.user.id },
    });
  }

  return NextResponse.json({ success: true });
}
