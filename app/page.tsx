"use client";

import { useEffect, useMemo, useState } from "react";
import { formatBytes, mimeForFile } from "@/lib/utils";
import ConfirmDialog from "@/components/ConfirmDialog";
import VideoPreview from "@/components/VideoPreview";

interface FileEntry {
  name: string;
  size: number;
  modified: string;
  url: string;
}

type View = "list" | "grid";

const VIDEO_EXTS = ["mp4", "webm", "mov", "m4a", "ogv", "avi", "mkv"];
const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "avif", "bmp", "ico"];

function kindOf(name: string): "video" | "image" | "other" {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (VIDEO_EXTS.includes(ext)) return "video";
  if (IMAGE_EXTS.includes(ext)) return "image";
  return "other";
}

function extOf(name: string): string {
  const parts = name.split(".");
  if (parts.length < 2) return "•";
  return parts.pop()!.toUpperCase().slice(0, 4);
}

// Shared thumbnail: video shows its first frame, images show a preview,
// everything else shows an extension tile. Media elements only ever fetch
// metadata / lazy ranges — never the full file — and repeat views come
// from the browser + CDN cache, so thumbs cost almost no bandwidth.
function ThumbMedia({ file, className }: { file: FileEntry; className: string }) {
  const kind = kindOf(file.name);
  if (kind === "video") {
    return (
      <video
        src={file.url}
        muted
        playsInline
        preload="metadata"
        className={`pointer-events-none object-cover ${className}`}
      />
    );
  }
  if (kind === "image") {
    return (
      <img
        src={file.url}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className={`pointer-events-none object-cover ${className}`}
      />
    );
  }
  return (
    <span
      className={`grid place-items-center bg-zinc-100 font-mono font-bold tracking-wide text-zinc-500 ${className}`}
    >
      {extOf(file.name)}
    </span>
  );
}

function LockIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function UploadIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 20h16" />
    </svg>
  );
}

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function ListIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="4" cy="12" r="1" fill="currentColor" />
      <circle cx="4" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

function GridIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export default function Home() {
  const [unlocked, setUnlocked] = useState(false);
  const [pass, setPass] = useState("");
  const [passError, setPassError] = useState("");
  const [checking, setChecking] = useState(false);

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>(() =>
    typeof window !== "undefined" && localStorage.getItem("view") === "grid"
      ? "grid"
      : "list"
  );
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [confirmLock, setConfirmLock] = useState(false);
  const [preview, setPreview] = useState<FileEntry | null>(null);
  const [android, setAndroid] = useState(false);

  useEffect(() => {
    // One-time UA check after mount so server HTML and first client render
    // match (avoids hydration mismatch); re-render with intent: links after.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (/Android/i.test(navigator.userAgent)) setAndroid(true);
  }, []);

  function setViewAndSave(v: View) {
    setView(v);
    try {
      localStorage.setItem("view", v);
    } catch {}
  }

  function authHeaders(): HeadersInit {
    return { "x-master-password": sessionStorage.getItem("master") || "" };
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/files", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setFiles(data.files || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function unlock(e?: React.FormEvent) {
    e?.preventDefault();
    setChecking(true);
    setPassError("");
    try {
      const res = await fetch("/api/files", {
        headers: { "x-master-password": pass.trim() },
      });
      if (res.status === 401) {
        setPassError("Incorrect password — try again");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      sessionStorage.setItem("master", pass.trim());
      setFiles(data.files || []);
      setUnlocked(true);
      setPass("");
    } catch (e) {
      setPassError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function uploadList(list: FileList | File[]) {
    const arr = Array.from(list);
    if (arr.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      arr.forEach((f) => fd.append("files", f, f.name));
      const res = await fetch("/api/files", {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json();
      if (res.status === 401) {
        sessionStorage.removeItem("master");
        setUnlocked(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setFiles(data.files || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/files?file=${encodeURIComponent(pendingDelete)}`,
        { method: "DELETE", headers: authHeaders() }
      );
      const data = await res.json();
      if (res.status === 401) {
        sessionStorage.removeItem("master");
        setUnlocked(false);
        setPendingDelete(null);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setFiles(data.files || []);
      setPendingDelete(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  function lock() {
    sessionStorage.removeItem("master");
    setUnlocked(false);
    setFiles([]);
    setQuery("");
    setConfirmLock(false);
  }

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? files.filter((f) => f.name.toLowerCase().includes(q)) : files),
    [files, q]
  );

  // On Android, open videos with an intent: URL so the system offers the
  // phone's own players (MX Player, VLC, Gallery…). Fallback is the normal
  // link if no player handles it. Everywhere else, use the direct URL
  // (iOS Safari plays .mov natively; desktops use their default app).
  function playUrl(file: FileEntry): string {
    if (!android || kindOf(file.name) !== "video") return file.url;
    const m = file.url.match(/^https:\/\/([^/]+)(\/.*)$/);
    if (!m) return file.url;
    const type = mimeForFile(file.name, "video/*");
    return (
      `intent://${m[1]}${m[2]}#Intent;scheme=https;type=${type};` +
      `action=android.intent.action.VIEW;` +
      `S.browser_fallback_url=${encodeURIComponent(file.url)};end`
    );
  }

  return (
    <main className="relative mx-auto flex min-h-dvh w-full flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 sm:pt-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_40%_at_50%_0%,#e4e4e7_0%,transparent_70%)]"
      />
      <div className="m-auto w-full max-w-xl">
      {!unlocked ? (
        <div className="w-full">
          <form
            onSubmit={unlock}
            className="rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.25)] sm:p-10"
          >
            <div className="mx-auto grid h-13 w-13 place-items-center rounded-2xl bg-zinc-950 p-3.5 text-white">
              <LockIcon />
            </div>
            <h1 className="mt-5 text-center text-[22px] font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1 text-center text-sm text-zinc-500">
              Enter your password to access files
            </p>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••"
              autoFocus
              className="mt-6 h-13 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-center text-lg tracking-[0.3em] indent-[0.3em] outline-none transition placeholder:text-zinc-300 focus:border-zinc-950 focus:bg-white focus:ring-4 focus:ring-zinc-950/5"
            />
            <div className="mt-3 min-h-5 text-center text-[13px] font-medium text-red-600">
              {passError}
            </div>
            <button
              type="submit"
              disabled={checking || !pass.trim()}
              className="h-[52px] w-full rounded-2xl bg-zinc-950 text-[15px] font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checking ? "Checking…" : "Unlock"}
            </button>
          </form>
          <p className="mt-5 text-center text-xs text-zinc-400">
            Private storage · secured by password
          </p>
        </div>
      ) : (
        <div className="w-full">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-baseline gap-2">
              <h1 className="text-[22px] font-semibold tracking-tight">Files</h1>
              <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                {filtered.length}
                {q ? ` of ${files.length}` : ""}
              </span>
            </div>
            <button
              onClick={() => setConfirmLock(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-2 text-[13px] font-medium text-zinc-500 shadow-sm transition hover:border-zinc-300 hover:text-zinc-900"
            >
              <LockIcon className="h-3.5 w-3.5" />
              Lock
            </button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files) uploadList(e.dataTransfer.files);
            }}
            className={`mt-4 rounded-[24px] border-[1.5px] border-dashed bg-white p-6 text-center transition-all sm:p-10 ${
              dragOver
                ? "scale-[1.01] border-zinc-950 bg-zinc-950/[0.02]"
                : "border-zinc-300 hover:border-zinc-400"
            }`}
          >
            <div
              className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl transition ${
                dragOver ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-500"
              }`}
            >
              <UploadIcon />
            </div>
            <div className="mt-3 text-[15px] font-semibold tracking-tight">
              {uploading ? "Uploading…" : "Drop files here"}
            </div>
            <div className="mt-0.5 text-[13px] text-zinc-400">
              {uploading ? "Please wait" : "or choose from your device"}
            </div>
            <label
              className={`mt-4 inline-block cursor-pointer rounded-full px-5 py-3 text-sm font-semibold transition active:scale-[0.98] ${
                uploading
                  ? "cursor-wait bg-zinc-100 text-zinc-400"
                  : "bg-zinc-950 text-white hover:bg-zinc-800"
              }`}
            >
              Browse files
              <input
                type="file"
                multiple
                disabled={uploading}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) uploadList(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {error && (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Search + view toggle */}
          <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                <SearchIcon />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search files…"
                className="h-11 w-full rounded-2xl border border-zinc-200 bg-white pl-10 pr-9 text-[16px] outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-4 focus:ring-zinc-950/5 sm:text-sm"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-zinc-100 text-xs text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex shrink-0 rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm">
              {(
                [
                  ["list", <ListIcon key="l" />, "List view"],
                  ["grid", <GridIcon key="g" />, "Grid view"],
                ] as [View, React.ReactNode, string][]
              ).map(([v, icon, label]) => (
                <button
                  key={v}
                  onClick={() => setViewAndSave(v)}
                  title={label}
                  aria-label={label}
                  aria-pressed={view === v}
                  className={`grid h-9 w-10 place-items-center rounded-xl transition ${
                    view === v
                      ? "bg-zinc-950 text-white"
                      : "text-zinc-400 hover:text-zinc-900"
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Files */}
          <div className="mt-3 overflow-hidden rounded-[24px] border border-zinc-200/80 bg-white shadow-[0_12px_40px_-20px_rgba(0,0,0,0.2)]">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-zinc-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-950" />
                Loading…
              </div>
            ) : files.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-sm font-medium text-zinc-500">Nothing here yet</div>
                <div className="mt-0.5 text-[13px] text-zinc-400">
                  Upload your first file above
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-sm font-medium text-zinc-500">No matches</div>
                <div className="mt-0.5 break-words text-[13px] text-zinc-400">
                  Nothing named “{query.trim()}”
                </div>
              </div>
            ) : view === "list" ? (
              <ul className="divide-y divide-zinc-100">
                {filtered.map((f) => (
                  <li
                    key={f.name}
                    className="group flex items-center gap-2.5 px-3 py-2.5 transition hover:bg-zinc-50/80 sm:gap-3 sm:px-4 sm:py-3"
                  >
                    {kindOf(f.name) === "video" ? (
                      <button
                        onClick={() => setPreview(f)}
                        aria-label={`Preview ${f.name}`}
                        className="h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl transition hover:ring-2 hover:ring-zinc-950/20 active:scale-[0.97]"
                      >
                        <ThumbMedia file={f} className="h-full w-full text-[10px]" />
                      </button>
                    ) : (
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl">
                        <ThumbMedia file={f} className="h-full w-full text-[10px]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm font-medium tracking-tight hover:underline"
                      >
                        {f.name}
                      </a>
                      <div className="mt-0.5 text-xs tabular-nums text-zinc-400">
                        {formatBytes(f.size)}
                      </div>
                    </div>
                    <a
                      href={playUrl(f)}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 active:scale-[0.97]"
                    >
                      Open
                    </a>
                    <button
                      onClick={() => setPendingDelete(f.name)}
                      className="shrink-0 rounded-full px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:bg-red-50 hover:text-red-600 active:scale-[0.97]"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 p-2.5 sm:grid-cols-3 sm:gap-3 sm:p-3">
                {filtered.map((f) => {
                  return (
                    <div
                      key={f.name}
                      className="overflow-hidden rounded-2xl border border-zinc-100 bg-white transition hover:border-zinc-200 hover:shadow-md"
                    >
                      {kindOf(f.name) === "video" ? (
                        <button
                          onClick={() => setPreview(f)}
                          aria-label={`Preview ${f.name}`}
                          className="relative block aspect-square w-full cursor-pointer overflow-hidden bg-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-950"
                        >
                          <ThumbMedia file={f} className="h-full w-full text-lg" />
                          <span className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-zinc-950/70 text-[10px] text-white">
                            ▶
                          </span>
                        </button>
                      ) : (
                        <a
                          href={playUrl(f)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${f.name}`}
                          className="relative block aspect-square overflow-hidden bg-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-950"
                        >
                          <ThumbMedia file={f} className="h-full w-full text-lg" />
                        </a>
                      )}
                      <div className="p-2.5">
                        <div className="truncate text-[13px] font-medium tracking-tight" title={f.name}>
                          {f.name}
                        </div>
                        <div className="mt-0.5 text-[11px] tabular-nums text-zinc-400">
                          {formatBytes(f.size)}
                        </div>
                        <div className="mt-2 flex flex-col gap-1.5">
                          <a
                            href={playUrl(f)}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full rounded-full bg-zinc-950 py-2 text-center text-xs font-semibold text-white transition hover:bg-zinc-700 active:scale-[0.97]"
                          >
                            Open
                          </a>
                          <button
                            onClick={() => setPendingDelete(f.name)}
                            className="w-full rounded-full py-2 text-xs font-semibold text-zinc-400 transition hover:bg-red-50 hover:text-red-600 active:scale-[0.97]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={load}
            className="mt-3 w-full rounded-2xl border border-zinc-200 bg-white py-3 text-[13px] font-medium text-zinc-500 shadow-sm transition hover:border-zinc-300 hover:text-zinc-900"
          >
            Refresh
          </button>
          <p className="mt-5 text-center text-[11px] text-zinc-400">
            Stored on Bunny.net · served over CDN
          </p>
        </div>
      )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete file?"
          message={`“${pendingDelete}” will be permanently removed from storage. This can't be undone.`}
          confirmLabel="Delete"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => !deleting && setPendingDelete(null)}
        />
      )}
      {confirmLock && (
        <ConfirmDialog
          title="Lock files?"
          message="You'll need the password to access files again."
          confirmLabel="Lock"
          onConfirm={lock}
          onCancel={() => setConfirmLock(false)}
        />
      )}
      {preview && (
        <VideoPreview file={preview} onClose={() => setPreview(null)} />
      )}
    </main>
  );
}
