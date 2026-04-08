import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const runtime = "nodejs";
const updateSchema = z.object({
  firstName: z.string().min(2).max(30),
  lastName: z.string().min(2).max(30),
  avatar: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  age: z.number().min(0).max(120).optional().default(0),
  birthDate: z.string().optional().default(""),
  gender: z.enum(["male", "female", "non-binary", "prefer-not-to-say"]),
  bio: z.string().max(300).optional().default(""),
});

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const user = await User.findById(session.user.id)
    .select("firstName lastName email avatar phone age birthDate gender bio connections pendingReceived")
    .lean();

  return NextResponse.json({ user });
}

export async function PUT(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  await connectDB();

  const birthDate = parsed.data.birthDate ? new Date(parsed.data.birthDate) : null;
  const today = new Date();
  let age = parsed.data.age;

  if (birthDate && !Number.isNaN(birthDate.getTime())) {
    const monthDiff = today.getMonth() - birthDate.getMonth();
    age = today.getFullYear() - birthDate.getFullYear();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }
  }

  const user = await User.findByIdAndUpdate(
    session.user.id,
    {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      avatar: parsed.data.avatar,
      phone: parsed.data.phone,
      age,
      birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : null,
      gender: parsed.data.gender,
      bio: parsed.data.bio,
    },
    { new: true }
  )
    .select("firstName lastName email avatar phone age birthDate gender bio")
    .lean();

  return NextResponse.json({ user });
}
