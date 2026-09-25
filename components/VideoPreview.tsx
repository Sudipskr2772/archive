"use client";

import { useEffect, useRef, useState } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { mimeForFile } from "@/lib/utils";

interface Props {
  file: { name: string; size: number; url: string };
  onClose: () => void;
}

type Phase =
  | "working"
  | "playing"
  | "toobig"
  | "unsupported"
  | "error";

const CORE_BASE =
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
const MAX_CONVERT_BYTES = 800 * 1024 * 1024;

// Converter engine loads once per session (~30MB first time, cached after).
let enginePromise: Promise<FFmpeg> | null = null;
async function getEngine(): Promise<FFmpeg> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);
      const ff = new FFmpeg();
      const [coreURL, wasmURL, workerURL] = await Promise.all([
        toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
        toBlobURL(`${CORE_BASE}/ffmpeg-core.worker.js`, "text/javascript"),
      ]);
      await ff.load({ coreURL, wasmURL, workerURL });
      return ff;
    })().catch((e) => {
      enginePromise = null;
      throw e;
    });
  }
  return enginePromise;
}

// Converted outputs stay cached for the session: reopening the same video
// replays instantly with no re-download and no re-convert.
const convertedCache = new Map<string, string>();

export default function VideoPreview({ file, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("working");
  const [status, setStatus] = useState("Checking playback…");
  const [progress, setProgress] = useState<number | null>(null);
  const [src, setSrc] = useState("");
  const [direct, setDirect] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    let objectUrl = "";

    (async () => {
      try {
        if (file.size > MAX_CONVERT_BYTES) {
          setPhase("toobig");
          return;
        }
        // 1. Native playback when the browser understands the file.
        const probe = document.createElement("video");
        if (probe.canPlayType(mimeForFile(file.name)) !== "") {
          if (cancelled.current) return;
          setSrc(file.url);
          setDirect(true);
          setPhase("playing");
          return;
        }
        // 2. Reuse a previous conversion from this session.
        const cached = convertedCache.get(file.url);
        if (cached) {
          if (cancelled.current) return;
          setSrc(cached);
          setStatus("Converted earlier — replaying instantly");
          setPhase("playing");
          return;
        }
        // 3. Remux (no re-encode) to .mp4 so Chrome/Edge/Firefox can play it.
        setStatus("Loading converter (one-time download, then cached)…");
        setProgress(null);
        const { fetchFile } = await import("@ffmpeg/util");
        const ff = await getEngine();
        if (cancelled.current) return;
        ff.on("progress", ({ progress: p }) => {
          if (cancelled.current) return;
          if (Number.isFinite(p) && p > 0) setProgress(Math.min(99, Math.round(p * 100)));
        });
        setStatus("Downloading video…");
        const data = await fetchFile(file.url);
        if (cancelled.current) return;
        await ff.writeFile("input", data);
        setStatus("Converting for this browser…");
        const code = await ff.exec([
          "-i",
          "input",
          "-c",
          "copy",
          "-movflags",
          "+faststart",
          "output.mp4",
        ]);
        if (code !== 0) throw new Error(`convert exited with ${code}`);
        const out = await ff.readFile("output.mp4");
        const raw = out instanceof Uint8Array ? out : new TextEncoder().encode(out);
        const bytes = new Uint8Array(raw.length);
        bytes.set(raw);
        try {
          await ff.deleteFile("input");
          await ff.deleteFile("output.mp4");
        } catch {}
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: "video/mp4" }));
        convertedCache.set(file.url, objectUrl);
        objectUrl = ""; // owned by the cache now
        if (cancelled.current) return;
        setSrc(convertedCache.get(file.url)!);
        setStatus("Converted — cached for this session");
        setPhase("playing");
      } catch (e) {
        if (cancelled.current) return;
        setStatus(
          /Failed to fetch|Load failed|network|CORS/i.test((e as Error).message)
            ? "Couldn't fetch the file for conversion."
            : "Conversion failed."
        );
        setPhase("error");
      }
    })();

    return () => {
      cancelled.current = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.url, file.name, file.size]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="animate-fade-in absolute inset-0 bg-zinc-950/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="animate-dialog-pop relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-zinc-200/80 bg-white p-4 shadow-2xl sm:p-5">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold tracking-tight">
              {file.name}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">{status}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-100 text-lg text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl bg-black">
          {phase === "playing" && src ? (
            <video
              key={src}
              src={src}
              controls
              autoPlay
              playsInline
              preload="auto"
              className="aspect-video w-full"
              onError={() => {
                if (!direct) {
                  setStatus(
                    "This file's codec can't play in this browser even after conversion."
                  );
                  setPhase("unsupported");
                }
              }}
            />
          ) : phase === "working" ? (
            <div className="grid aspect-video place-items-center">
              <div className="w-3/4 max-w-xs text-center">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                  {progress === null ? (
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-white/70" />
                  ) : (
                    <div
                      className="h-full rounded-full bg-white/90 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  )}
                </div>
                <div className="mt-3 text-sm text-zinc-300">
                  {progress === null ? status : `${status} ${progress}%`}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid aspect-video place-items-center p-6 text-center">
              <div>
                <div className="text-3xl">🎬</div>
                <div className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-zinc-300">
                  {phase === "toobig" &&
                    "This file is too large to convert in the browser. Download it and watch in VLC or MX Player."}
                  {phase === "unsupported" &&
                    `${status} Download it and watch in VLC or MX Player.`}
                  {phase === "error" && `${status} You can still download it.`}
                </div>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
                >
                  Download instead
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
