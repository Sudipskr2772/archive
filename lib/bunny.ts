import { sanitizeFileName } from "./utils";

export interface BunnyFile {
  name: string;
  size: number;
  modified: string;
  url: string;
}

export function getBunnyConfig() {
  const storageZone = (process.env.BUNNY_STORAGE_ZONE || "").trim();
  const password = (process.env.BUNNY_STORAGE_PASSWORD || "").trim();
  const endpoint = (
    process.env.BUNNY_STORAGE_ENDPOINT || "https://storage.bunnycdn.com"
  )
    .trim()
    .replace(/\/+$/, "");
  const cdnHostname = (process.env.BUNNY_CDN_HOSTNAME || "")
    .trim()
    .replace(/\/+$/, "");
  return { storageZone, password, endpoint, cdnHostname };
}

export function isBunnyConfigured(): boolean {
  const c = getBunnyConfig();
  return Boolean(c.storageZone && c.password);
}

export function getPublicUrl(fileName: string): string {
  const { cdnHostname, storageZone, endpoint } = getBunnyConfig();
  const safe = encodeURIComponent(sanitizeFileName(fileName));
  if (cdnHostname) return `${cdnHostname}/${safe}`;
  return `${endpoint}/${storageZone}/${safe}`;
}

export async function listBunnyFiles(): Promise<BunnyFile[]> {
  const { password, endpoint, storageZone } = getBunnyConfig();
  if (!password || !storageZone) throw new Error("Bunny storage not configured");
  const res = await fetch(`${endpoint}/${storageZone}/`, {
    headers: { AccessKey: password },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Bunny list failed (${res.status}): ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .filter((o) => o && !o.IsDirectory && o.ObjectName)
    .map((o) => ({
      name: String(o.ObjectName),
      size: Number(o.Length) || 0,
      modified: String(o.LastChanged || o.DateCreated || ""),
      url: getPublicUrl(String(o.ObjectName)),
    }))
    .sort((a, b) => b.modified.localeCompare(a.modified));
}

export async function uploadBunnyFile(
  fileName: string,
  data: Buffer | Uint8Array,
  contentType = "application/octet-stream"
): Promise<void> {
  const { password, endpoint, storageZone } = getBunnyConfig();
  if (!password || !storageZone) throw new Error("Bunny storage not configured");
  const safe = sanitizeFileName(fileName);
  const url = `${endpoint}/${storageZone}/${encodeURIComponent(safe)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { AccessKey: password, "Content-Type": contentType },
    body: data as unknown as BodyInit,
  });
  if (res.status !== 201 && res.status !== 200) {
    const t = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${t.slice(0, 300)}`);
  }
}

export async function deleteBunnyFile(fileName: string): Promise<void> {
  const { password, endpoint, storageZone } = getBunnyConfig();
  if (!password || !storageZone) throw new Error("Bunny storage not configured");
  const url = `${endpoint}/${storageZone}/${encodeURIComponent(fileName)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { AccessKey: password },
  });
  if (res.status !== 200 && res.status !== 404) {
    const t = await res.text().catch(() => "");
    throw new Error(`Delete failed (${res.status}): ${t.slice(0, 300)}`);
  }
}
