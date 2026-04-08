import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import User from "@/models/User";

export const runtime = "nodejs";

const acceptSchema = z.object({
  requesterId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await connectDB();

  const me = await User.findById(session.user.id);
  const requester = await User.findById(parsed.data.requesterId);

  if (!me || !requester) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  me.pendingReceived = me.pendingReceived.filter(
    (id: { toString: () => string }) => id.toString() !== requester._id.toString()
  );
  requester.pendingSent = requester.pendingSent.filter(
    (id: { toString: () => string }) => id.toString() !== me._id.toString()
  );

  if (!me.connections.some((id: { toString: () => string }) => id.toString() === requester._id.toString())) {
    me.connections.push(requester._id);
  }
  if (!requester.connections.some((id: { toString: () => string }) => id.toString() === me._id.toString())) {
    requester.connections.push(me._id);
  }

  await me.save();
  await requester.save();

  await Notification.create({
    user: requester._id,
    type: "connection_accepted",
    title: "Connection accepted",
    body: `${session.user.firstName} accepted your connection request.`,
    link: `/profile/${session.user.id}`,
    meta: { from: session.user.id },
  });

  return NextResponse.json({ success: true });
}
