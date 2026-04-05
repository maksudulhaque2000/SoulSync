import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";

const patchSchema = z.object({
  id: z.string().optional(),
  markAll: z.boolean().optional(),
});

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const notifications = await Notification.find({ user: session.user.id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const unread = await Notification.countDocuments({ user: session.user.id, read: false });

  return NextResponse.json({ notifications, unread });
}

export async function PATCH(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await connectDB();

  if (parsed.data.markAll) {
    await Notification.updateMany({ user: session.user.id, read: false }, { $set: { read: true } });
    return NextResponse.json({ success: true });
  }

  if (parsed.data.id) {
    await Notification.updateOne({ _id: parsed.data.id, user: session.user.id }, { $set: { read: true } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Missing id or markAll" }, { status: 400 });
}
