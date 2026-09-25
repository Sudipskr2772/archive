import { NextRequest } from "next/server";

export function checkMasterPassword(req: NextRequest): boolean {
  const expected = (process.env.MASTER_PASSWORD || "200431").trim();
  const got =
    req.headers.get("x-master-password")?.trim() ||
    new URL(req.url).searchParams.get("key")?.trim() ||
    "";
  return got.length > 0 && got === expected;
}
