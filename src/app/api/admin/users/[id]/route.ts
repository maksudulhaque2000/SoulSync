import { NextResponse } from "next/server";
import { z } from "zod";

import { SYSTEM_ADMIN_EMAIL } from "@/lib/admin";
import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";
import Notification from "@/models/Notification";
import Post from "@/models/Post";
import User from "@/models/User";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i),
});

const patchSchema = z
  .object({
    action: z.enum(["block", "unblock", "restrict", "clearRestriction", "setRole"]).optional(),
    duration: z.enum(["24h", "3d", "7d", "30d"]).optional(),
    role: z.enum(["user", "admin"]).optional(),
    reason: z.string().max(300).optional(),
  })
  .refine((payload) => Boolean(payload.action) || Boolean(payload.role), {
    message: "Missing action",
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
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const body = await req.json();
  const parsedBody = patchSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const targetUserId = parsedParams.data.id;
  const action = parsedBody.data.action ?? (parsedBody.data.role ? "setRole" : null);

  if (!action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  await connectDB();

  const targetUser = await User.findById(targetUserId).select("role");
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (targetUser._id.toString() === session.user.id) {
    return NextResponse.json({ error: "You cannot modify your own admin account" }, { status: 400 });
  }

  const targetUserEmail = await User.findById(targetUserId).select("email").lean();
  if (targetUserEmail?.email?.toLowerCase?.() === SYSTEM_ADMIN_EMAIL) {
    return NextResponse.json({ error: "System admin cannot be modified" }, { status: 400 });
  }

  if (action === "setRole") {
    if (!parsedBody.data.role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    if (targetUser.role === "admin" && parsedBody.data.role === "user") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return NextResponse.json({ error: "At least one admin account must remain." }, { status: 400 });
      }
    }

    const updated = await User.findByIdAndUpdate(
      targetUserId,
      { role: parsedBody.data.role },
      { new: true }
    )
      .select("firstName lastName email avatar role isBlocked blockedAt blockReason postRestrictionUntil postRestrictionReason createdAt")
      .lean();

    return NextResponse.json({ user: updated });
  }

  if (action === "block") {
    const updated = await User.findByIdAndUpdate(
      targetUserId,
      {
        isBlocked: true,
        blockReason: parsedBody.data.reason ?? "Blocked by admin",
        blockedAt: new Date(),
        postRestrictionUntil: null,
        postRestrictionReason: "",
      },
      { new: true }
    )
      .select("firstName lastName email avatar role isBlocked blockedAt blockReason postRestrictionUntil postRestrictionReason createdAt")
      .lean();

    return NextResponse.json({ user: updated });
  }

  if (action === "unblock") {
    const updated = await User.findByIdAndUpdate(
      targetUserId,
      {
        isBlocked: false,
        blockReason: "",
        blockedAt: null,
      },
      { new: true }
    )
      .select("firstName lastName email avatar role isBlocked blockedAt blockReason postRestrictionUntil postRestrictionReason createdAt")
      .lean();

    return NextResponse.json({ user: updated });
  }

  if (action === "restrict") {
    if (!parsedBody.data.duration) {
      return NextResponse.json({ error: "Duration is required" }, { status: 400 });
    }

    const updated = await User.findByIdAndUpdate(
      targetUserId,
      {
        postRestrictionUntil: getDurationDate(parsedBody.data.duration),
        postRestrictionReason: parsedBody.data.reason ?? "Posting restricted by admin",
      },
      { new: true }
    )
      .select("firstName lastName email avatar role isBlocked blockedAt blockReason postRestrictionUntil postRestrictionReason createdAt")
      .lean();

    return NextResponse.json({ user: updated });
  }

  if (action === "clearRestriction") {
    const updated = await User.findByIdAndUpdate(
      targetUserId,
      {
        postRestrictionUntil: null,
        postRestrictionReason: "",
      },
      { new: true }
    )
      .select("firstName lastName email avatar role isBlocked blockedAt blockReason postRestrictionUntil postRestrictionReason createdAt")
      .lean();

    return NextResponse.json({ user: updated });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const targetUserId = parsedParams.data.id;

  if (targetUserId === session.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  await connectDB();

  const targetUser = await User.findById(targetUserId).select("role");
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const targetUserEmail = await User.findById(targetUserId).select("email").lean();
  if (targetUserEmail?.email?.toLowerCase?.() === SYSTEM_ADMIN_EMAIL) {
    return NextResponse.json({ error: "System admin cannot be deleted" }, { status: 400 });
  }

  if (targetUser.role === "admin") {
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "At least one admin account must remain." }, { status: 400 });
    }
  }

  const deletedRole = targetUser.role;

  await Promise.all([
    Post.deleteMany({ author: targetUserId }),
    Post.updateMany(
      {},
      {
        $pull: {
          comments: { user: targetUserId },
          reactions: { user: targetUserId },
        },
      }
    ),
    Message.deleteMany({
      $or: [{ from: targetUserId }, { to: targetUserId }],
    }),
    Notification.deleteMany({ user: targetUserId }),
    User.updateMany(
      {},
      {
        $pull: {
          connections: targetUserId,
          pendingSent: targetUserId,
          pendingReceived: targetUserId,
          blockedUsers: targetUserId,
        },
      }
    ),
    User.findByIdAndDelete(targetUserId),
  ]);

  return NextResponse.json({ success: true, deletedRole });
}
