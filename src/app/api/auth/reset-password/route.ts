import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { connectDB } from "@/lib/db";
import { hashPasswordResetToken } from "@/lib/password-reset";
import User from "@/models/User";

export const runtime = "nodejs";

const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().min(20),
  password: z.string().min(6).max(100),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid reset request" }, { status: 400 });
    }

    await connectDB();

    const email = parsed.data.email.toLowerCase();
    const tokenHash = hashPasswordResetToken(parsed.data.token);

    const user = await User.findOne({
      email,
      passwordResetToken: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select("+passwordResetToken +passwordResetExpiresAt");

    if (!user) {
      return NextResponse.json({ error: "Reset link is invalid or expired" }, { status: 400 });
    }

    user.password = await bcrypt.hash(parsed.data.password, 10);
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;

    await user.save();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
