import { NextResponse } from "next/server";
import { z } from "zod";

import { SYSTEM_ADMIN_EMAIL } from "@/lib/admin";
import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs";

const payloadSchema = z.object({
  action: z.enum(["block", "unblock", "restrict", "clearRestriction", "setRole"]),
  duration: z.enum(["24h", "3d", "7d", "30d"]).optional(),
  role: z.enum(["user", "admin"]).optional(),
  reason: z.string().max(300).optional(),
});

function getDurationDate(duration: "24h" | "3d" | "7d" | "30d") {
  const hoursMap: Record<typeof duration, number> = {
    "24h": 24,
    "3d": 72,
    "7d": 168,
    "30d": 720,
  };

  return new Date(Date.now() + hoursMap[duration] * 60 * 60 * 1000);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await connectDB();

  const me = await User.findById(session.user.id)
    .select("role")
    .lean();

  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const target = await User.findById(id);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (target._id.toString() === session.user.id) {
    return NextResponse.json({ error: "You cannot modify your own admin account" }, { status: 400 });
  }

  if (target.email === SYSTEM_ADMIN_EMAIL) {
    return NextResponse.json({ error: "System admin cannot be modified" }, { status: 400 });
  }

  const { action, reason } = parsed.data;

  if (action === "setRole") {
    if (!parsed.data.role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    if (target.role === "admin" && parsed.data.role === "user") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return NextResponse.json({ error: "At least one admin must remain" }, { status: 400 });
      }
    }

    target.role = parsed.data.role;
    await target.save();

    return NextResponse.json({ success: true });
  }

  if (action === "block") {
    target.isBlocked = true;
    target.blockReason = reason ?? "Blocked by admin";
    target.blockedAt = new Date();
    target.postRestrictionUntil = null;
    target.postRestrictionReason = "";
    await target.save();

    return NextResponse.json({ success: true });
  }

  if (action === "unblock") {
    target.isBlocked = false;
    target.blockReason = "";
    target.blockedAt = null;
    await target.save();

    return NextResponse.json({ success: true });
  }

  if (action === "restrict") {
    if (!parsed.data.duration) {
      return NextResponse.json({ error: "Duration is required" }, { status: 400 });
    }

    target.postRestrictionUntil = getDurationDate(parsed.data.duration);
    target.postRestrictionReason = reason ?? "Posting restricted by admin";
    await target.save();

    return NextResponse.json({ success: true });
  }

  if (action === "clearRestriction") {
    target.postRestrictionUntil = null;
    target.postRestrictionReason = "";
    await target.save();

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
