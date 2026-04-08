import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { put } from "@vercel/blob";
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
  const buffer = Buffer.from(await file.arrayBuffer());

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`uploads/${safeName}`, file, {
      access: "public",
    });

    const type = file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "file";

    return NextResponse.json({
      url: blob.url,
      name: file.name,
      size: file.size,
      type,
    });
  }

  if (process.env.VERCEL === "1") {
    return NextResponse.json(
      {
        error: "BLOB_READ_WRITE_TOKEN is required for uploads on Vercel",
      },
      { status: 500 }
    );
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, safeName), buffer);

  const type = file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "file";

  return NextResponse.json({
    url: `/uploads/${safeName}`,
    name: file.name,
    size: file.size,
    type,
  });
}
