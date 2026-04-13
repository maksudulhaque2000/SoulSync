import nodemailer from "nodemailer";

type PasswordResetEmailPayload = {
  to: string;
  firstName: string;
  resetUrl: string;
};

let cachedTransporter: nodemailer.Transporter | null | undefined;

function getTransporter() {
  if (cachedTransporter !== undefined) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass || Number.isNaN(port)) {
    cachedTransporter = null;
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  return cachedTransporter;
}

export async function sendPasswordResetEmail({ to, firstName, resetUrl }: PasswordResetEmailPayload) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("SMTP is not configured. Password reset email was not sent.");
    console.info("Password reset URL:", resetUrl);
    return;
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@soulsync.local";
  const subject = "SoulSync password reset request";

  const text = [
    `Hi ${firstName},`,
    "",
    "We received a request to reset your SoulSync password.",
    `Use this link to set a new password: ${resetUrl}`,
    "",
    "This link expires in 30 minutes.",
    "If you did not request this, you can safely ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:0 auto;">
      <h2 style="margin-bottom:8px;">Reset your SoulSync password</h2>
      <p>Hi ${firstName},</p>
      <p>We received a request to reset your SoulSync password.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">
          Reset Password
        </a>
      </p>
      <p style="word-break:break-all;">If the button does not work, copy and paste this link into your browser:<br/>${resetUrl}</p>
      <p>This link expires in <strong>30 minutes</strong>.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}
