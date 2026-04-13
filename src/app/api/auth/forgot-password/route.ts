import { NextResponse } from "next/server";
import { z } from "zod";

import { connectDB } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { buildPasswordResetUrl, createPasswordResetToken } from "@/lib/password-reset";
import User from "@/models/User";

export const runtime = "nodejs";

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const genericMessage =
  "If an account exists for this email, a password reset link has been sent.";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: genericMessage });
    }

    await connectDB();

    const email = parsed.data.email.toLowerCase();
    const user = await User.findOne({ email }).select("_id email firstName");

    if (user) {
      const { token, tokenHash, expiresAt } = createPasswordResetToken();

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordResetToken: tokenHash,
            passwordResetExpiresAt: expiresAt,
          },
        }
      );

      const resetUrl = buildPasswordResetUrl(req, token, email);

      try {
        await sendPasswordResetEmail({
          to: email,
          firstName: user.firstName,
          resetUrl,
        });
      } catch (error) {
        console.error("Failed to send password reset email", error);
      }
    }

    return NextResponse.json({ message: genericMessage });
  } catch {
    return NextResponse.json({ message: genericMessage });
  }
}
