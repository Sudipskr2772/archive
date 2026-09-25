"use client";

import { useState } from "react";
import { formatBytes } from "@/lib/utils";

interface FileEntry {
  name: string;
  size: number;
  modified: string;
  url: string;
}

export default function Home() {
  const [unlocked, setUnlocked] = useState(false);
  const [pass, setPass] = useState("");
  const [passError, setPassError] = useState("");
  const [checking, setChecking] = useState(false);

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

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
        setPassError("Wrong password");
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

  async function remove(name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    setError("");
    try {
      const res = await fetch(`/api/files?file=${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.status === 401) {
        sessionStorage.removeItem("master");
        setUnlocked(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setFiles(data.files || []);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function lock() {
    sessionStorage.removeItem("master");
    setUnlocked(false);
    setFiles([]);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-4 py-12">
      {!unlocked ? (
        <form
          onSubmit={unlock}
          className="w-full rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm"
        >
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-zinc-900 text-xl text-white">
            🔒
          </div>
          <h1 className="mt-4 text-xl font-bold">Enter password</h1>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Master password"
            autoFocus
            className="mt-5 h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-center text-lg tracking-widest outline-none focus:border-zinc-900"
          />
          {passError && (
            <div className="mt-3 text-sm font-medium text-red-600">{passError}</div>
          )}
          <button
            type="submit"
            disabled={checking || !pass.trim()}
            className="mt-4 h-12 w-full rounded-xl bg-zinc-900 font-bold text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {checking ? "Checking…" : "Unlock"}
          </button>
        </form>
      ) : (
        <div className="w-full">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Files ({files.length})</h1>
            <button
              onClick={lock}
              className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
            >
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
            className={`mt-4 rounded-2xl border-2 border-dashed bg-white p-8 text-center transition ${
              dragOver ? "border-zinc-900 bg-zinc-50" : "border-zinc-300"
            }`}
          >
            <div className="font-semibold">
              {uploading ? "Uploading…" : "Drop files here"}
            </div>
            <div className="mt-1 text-sm text-zinc-500">or</div>
            <label className="mt-3 inline-block cursor-pointer rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700">
              {uploading ? "Working…" : "Browse files"}
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
            <div className="mt-3 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {loading ? (
              <div className="p-6 text-center text-sm text-zinc-500">Loading…</div>
            ) : files.length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-500">
                No files yet. Upload something above.
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {files.map((f) => (
                  <li key={f.name} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm font-semibold hover:underline"
                      >
                        {f.name}
                      </a>
                      <div className="text-xs text-zinc-500">
                        {formatBytes(f.size)}
                      </div>
                    </div>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-700"
                    >
                      Open
                    </a>
                    <button
                      onClick={() => remove(f.name)}
                      className="shrink-0 rounded-full border border-red-300 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={load}
            className="mt-3 w-full rounded-xl border border-zinc-300 bg-white py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Refresh list
          </button>
        </div>
      )}
    </main>
  );
}
