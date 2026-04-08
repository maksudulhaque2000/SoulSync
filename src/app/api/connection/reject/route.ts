import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs";

const rejectSchema = z.object({
  requesterId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = rejectSchema.safeParse(body);
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

  await me.save();
  await requester.save();

  return NextResponse.json({ success: true });
}