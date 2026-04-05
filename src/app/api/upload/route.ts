import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const fileExt = file.name.split(".").pop() ?? "bin";
  const safeName = `${Date.now()}-${randomUUID()}.${fileExt}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");

  await mkdir(uploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, safeName), buffer);

  const type = file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "file";

  return NextResponse.json({
    url: `/uploads/${safeName}`,
    name: file.name,
    size: file.size,
    type,
  });
}
