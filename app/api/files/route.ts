import { NextRequest, NextResponse } from "next/server";
import { checkMasterPassword } from "@/lib/auth";
import {
  deleteBunnyFile,
  isBunnyConfigured,
  listBunnyFiles,
  uploadBunnyFile,
} from "@/lib/bunny";
import { mimeForFile, sanitizeFileName } from "@/lib/utils";

function denied() {
  return NextResponse.json({ error: "Wrong password" }, { status: 401 });
}

// GET /api/files — list files (header: x-master-password)
export async function GET(req: NextRequest) {
  if (!checkMasterPassword(req)) return denied();
  if (!isBunnyConfigured())
    return NextResponse.json({ error: "Bunny storage not configured" }, { status: 500 });
  try {
    const files = await listBunnyFiles();
    return NextResponse.json({ files });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST /api/files — upload (multipart form, files[] + header: x-master-password)
export async function POST(req: NextRequest) {
  if (!checkMasterPassword(req)) return denied();
  if (!isBunnyConfigured())
    return NextResponse.json({ error: "Bunny storage not configured" }, { status: 500 });
  try {
    const form = await req.formData();
    const incoming: File[] = [];
    for (const value of form.getAll("files")) {
      if (value instanceof File) incoming.push(value);
    }
    if (incoming.length === 0) {
      const single = form.get("file");
      if (single instanceof File) incoming.push(single);
    }
    if (incoming.length === 0)
      return NextResponse.json({ error: "No files received" }, { status: 400 });

    const uploaded: string[] = [];
    for (const f of incoming) {
      const name = sanitizeFileName(f.name || `upload-${Date.now()}`);
      const buf = Buffer.from(await f.arrayBuffer());
      await uploadBunnyFile(name, buf, mimeForFile(f.name, f.type));
      uploaded.push(name);
    }
    const files = await listBunnyFiles();
    return NextResponse.json({ uploaded, files }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE /api/files?file=name (header: x-master-password)
export async function DELETE(req: NextRequest) {
  if (!checkMasterPassword(req)) return denied();
  const name = new URL(req.url).searchParams.get("file") || "";
  if (!name)
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  try {
    await deleteBunnyFile(name);
    const files = await listBunnyFiles();
    return NextResponse.json({ ok: true, files });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
