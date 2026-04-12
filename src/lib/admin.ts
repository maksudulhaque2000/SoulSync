import bcrypt from "bcryptjs";

import User from "@/models/User";

export const SYSTEM_ADMIN_EMAIL = "admin@gmail.com";
export const SYSTEM_ADMIN_PASSWORD = "Password@123";

export async function ensureSystemAdminUser() {
  const email = SYSTEM_ADMIN_EMAIL.toLowerCase();
  const user = await User.findOne({ email });

  if (!user) {
    const passwordHash = await bcrypt.hash(SYSTEM_ADMIN_PASSWORD, 10);
    await User.create({
      firstName: "System",
      lastName: "Admin",
      email,
      password: passwordHash,
      role: "admin",
      isBlocked: false,
      blockReason: "",
      blockedAt: null,
      postRestrictionUntil: null,
      postRestrictionReason: "",
    });
    return;
  }

  const updates: Record<string, unknown> = {};

  if (!user.role || user.role !== "admin") {
    updates.role = "admin";
  }
  if (user.isBlocked) updates.isBlocked = false;
  if (user.blockReason) updates.blockReason = "";
  if (user.blockedAt) updates.blockedAt = null;
  if (user.postRestrictionUntil) updates.postRestrictionUntil = null;
  if (user.postRestrictionReason) updates.postRestrictionReason = "";

  const validPassword = await bcrypt.compare(SYSTEM_ADMIN_PASSWORD, user.password);
  if (!validPassword) {
    const newPasswordHash = await bcrypt.hash(SYSTEM_ADMIN_PASSWORD, 10);
    updates.password = newPasswordHash;
  }

  if (Object.keys(updates).length > 0) {
    await User.updateOne({ _id: user._id }, { $set: updates });
  }
}

export function getRestrictionExpiry(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
