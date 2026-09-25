export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "item"
  );
}

export function makeId(slug: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const stamp = Date.now().toString(36).slice(-4);
  return `${slug}-${rand}${stamp}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const v = bytes / Math.pow(1024, i);
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function sanitizeFileName(name: string): string {
  // Keep extension, replace unsafe chars
  const cleaned = name.replace(/[^a-zA-Z0-9.\-_() \[\]]/g, "_").slice(0, 180);
  return cleaned || `file-${Date.now()}`;
}

const MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
  opus: "audio/opus",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
  bmp: "image/bmp",
  ico: "image/x-icon",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  xml: "text/xml",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
};

// Browsers only play a file inline when it is served with a real content
// type. `File.type` from the browser is unreliable (often empty), so resolve
// the MIME type from the extension first.
export function mimeForFile(name: string, fallback = ""): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  if (fallback && fallback !== "application/octet-stream") return fallback;
  return "application/octet-stream";
}

export function parseTags(input: unknown): string[] {
  if (Array.isArray(input))
    return input.map(String).map((t) => t.trim()).filter(Boolean).slice(0, 20);
  if (typeof input === "string")
    return input
      .split(/[,;\n]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
  return [];
}

export function guessMediaTypeFromFiles(
  files: { name: string; type: string }[]
): string {
  if (!files.length) return "data";
  const exts = files.map((f) => f.name.split(".").pop()?.toLowerCase() ?? "");
  if (exts.some((e) => ["mp4", "webm", "mkv", "mov", "avi"].includes(e)))
    return "movies";
  if (exts.some((e) => ["mp3", "wav", "ogg", "flac", "m4a"].includes(e)))
    return "audio";
  if (
    exts.some((e) => ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(e))
  )
    return "image";
  if (exts.some((e) => ["pdf", "epub", "txt", "md", "doc", "docx"].includes(e)))
    return "texts";
  if (exts.some((e) => ["zip", "exe", "iso", "apk", "dmg", "tar", "gz"].includes(e)))
    return "software";
  return "data";
}
