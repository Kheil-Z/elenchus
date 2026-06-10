"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

// ── File-type detection ───────────────────────────────────────────────────────

type PreviewKind = "image" | "pdf" | "text" | "none";

const IMAGE_MIMES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "image/svg+xml", "image/bmp", "image/tiff",
]);
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tiff"]);
const TEXT_MIMES = new Set([
  "text/plain", "text/markdown", "text/csv", "text/html", "text/css",
  "text/javascript", "text/typescript", "application/json",
  "application/xml", "text/xml", "text/x-python", "text/x-yaml",
  "application/x-yaml",
]);
const TEXT_EXTS = new Set([
  ".txt", ".md", ".csv", ".json", ".xml", ".yaml", ".yml",
  ".ts", ".tsx", ".js", ".jsx", ".py", ".rb", ".go", ".rs",
  ".java", ".cpp", ".c", ".h", ".css", ".html", ".sh", ".env",
  ".toml", ".ini", ".cfg", ".conf", ".log",
]);

function getPreviewKind(mimeType: string | null | undefined, filename: string): PreviewKind {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();

  if (IMAGE_MIMES.has(mime) || IMAGE_EXTS.has(ext)) return "image";
  if (mime === "application/pdf" || ext === ".pdf") return "pdf";
  if (TEXT_MIMES.has(mime) || mime.startsWith("text/") || TEXT_EXTS.has(ext)) return "text";
  return "none";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Preview content area ──────────────────────────────────────────────────────

const TEXT_PREVIEW_LIMIT = 1.5 * 1024 * 1024; // 1.5 MB
const PDF_PREVIEW_LIMIT = 30 * 1024 * 1024; // 30 MB

function PreviewArea({
  kind,
  previewUrl,
  filename,
  sizeBytes,
}: {
  kind: PreviewKind;
  previewUrl: string;
  filename: string;
  sizeBytes: number;
}) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState(false);

  useEffect(() => {
    if (kind !== "text") return;
    if (sizeBytes > TEXT_PREVIEW_LIMIT) return;
    setTextLoading(true);
    fetch(previewUrl)
      .then((r) => r.text())
      .then((t) => { setTextContent(t); setTextLoading(false); })
      .catch(() => { setTextError(true); setTextLoading(false); });
  }, [kind, previewUrl, sizeBytes]);

  if (kind === "image") {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center bg-[#F7F5F0] p-6 min-h-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={filename}
          className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
        />
      </div>
    );
  }

  if (kind === "pdf") {
    if (sizeBytes > PDF_PREVIEW_LIMIT) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#F7F5F0] p-8 min-h-0">
          <span className="text-3xl opacity-40">📄</span>
          <p className="text-sm text-muted text-center">
            PDF is too large to preview in the browser ({formatBytes(sizeBytes)}).
          </p>
          <p className="text-xs text-muted/60 text-center">Use the download button below.</p>
        </div>
      );
    }
    return (
      <div className="flex-1 min-h-0 bg-[#F7F5F0]">
        <iframe
          src={previewUrl}
          title={filename}
          className="w-full h-full border-none"
          style={{ minHeight: "400px" }}
        />
      </div>
    );
  }

  if (kind === "text") {
    if (sizeBytes > TEXT_PREVIEW_LIMIT) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#F7F5F0] p-8 min-h-0">
          <span className="text-3xl opacity-40">📝</span>
          <p className="text-sm text-muted text-center">
            File is too large to preview ({formatBytes(sizeBytes)}).
          </p>
          <p className="text-xs text-muted/60 text-center">Use the download button below.</p>
        </div>
      );
    }
    if (textLoading) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#F7F5F0] min-h-0">
          <p className="text-sm text-muted animate-pulse">Loading preview…</p>
        </div>
      );
    }
    if (textError || textContent === null) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#F7F5F0] min-h-0">
          <p className="text-sm text-muted">Could not load preview.</p>
        </div>
      );
    }
    const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
    return (
      <div className="flex-1 overflow-auto min-h-0 bg-[#F7F5F0] p-4">
        <pre className="text-xs font-mono text-foreground leading-relaxed whitespace-pre-wrap break-words bg-surface border border-border rounded-xl p-4">
          {ext && (
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-3 not-italic">
              .{ext}
            </span>
          )}
          {textContent}
        </pre>
      </div>
    );
  }

  // kind === "none"
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#F7F5F0] p-8 min-h-0">
      <span className="text-3xl opacity-40">📦</span>
      <p className="text-sm text-muted text-center">No preview available for this file type.</p>
      <p className="text-xs text-muted/60 text-center">Download to open it in the right application.</p>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export interface DocPreviewModalProps {
  id: string;
  name: string;
  sizeBytes?: number;
  mimeType?: string | null;
  uploaderName?: string;
  createdAt?: string;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}

interface FetchedMeta {
  sizeBytes: number;
  mimeType: string | null;
  uploaderName: string;
  createdAt: string;
}

export function DocPreviewModal({
  id,
  name,
  sizeBytes: sizeProp,
  mimeType: mimeTypeProp,
  uploaderName: uploaderNameProp,
  createdAt: createdAtProp,
  onClose,
  onDeleted,
}: DocPreviewModalProps) {
  const [urls, setUrls] = useState<{ previewUrl: string; downloadUrl: string } | null>(null);
  const [fetchedMeta, setFetchedMeta] = useState<FetchedMeta | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isDeleted, setIsDeleted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const sizeBytes = sizeProp ?? fetchedMeta?.sizeBytes ?? 0;
  const mimeType = mimeTypeProp !== undefined ? mimeTypeProp : (fetchedMeta?.mimeType ?? null);
  const uploaderName = uploaderNameProp ?? fetchedMeta?.uploaderName ?? "";
  const createdAt = createdAtProp ?? fetchedMeta?.createdAt ?? "";

  const kind = getPreviewKind(mimeType, name);

  useEffect(() => {
    let cancelled = false;
    async function fetchUrl() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setUrlError("Not authenticated"); setLoadingUrl(false); return; }
      try {
        const res = await fetch(`/api/documents/${id}/url`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.status === 404) {
          if (!cancelled) setIsDeleted(true);
          if (!cancelled) setLoadingUrl(false);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          setUrls({ previewUrl: json.previewUrl, downloadUrl: json.downloadUrl });
          if (sizeProp === undefined) {
            setFetchedMeta({
              sizeBytes: json.sizeBytes ?? 0,
              mimeType: json.mimeType ?? null,
              uploaderName: json.uploaderName ?? "",
              createdAt: json.createdAt ?? "",
            });
          }
        } else {
          setUrlError(json.error ?? "Could not load file");
        }
      } catch {
        if (!cancelled) setUrlError("Network error");
      }
      if (!cancelled) setLoadingUrl(false);
    }
    fetchUrl();
    return () => { cancelled = true; };
  }, [id, sizeProp]);

  // Escape key to close
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (confirmDelete) setConfirmDelete(false);
        else onClose();
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [confirmDelete, onClose]);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setDeleteError("Not authenticated"); setDeleting(false); return; }
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.success) {
        onDeleted?.(id);
        onClose();
      } else {
        setDeleteError(json.error ?? "Delete failed");
        setDeleting(false);
        setConfirmDelete(false);
      }
    } catch {
      setDeleteError("Network error");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const mimeLabel = mimeType
    ? mimeType.split("/").pop()?.toUpperCase()
    : name.slice(name.lastIndexOf(".") + 1).toUpperCase() || "FILE";

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      style={{ backdropFilter: "blur(2px)" }}
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div
        className="bg-surface rounded-2xl shadow-2xl flex flex-col overflow-hidden w-full mx-4"
        style={{ maxWidth: "820px", maxHeight: "88vh" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <span className="text-xl shrink-0" aria-hidden>📄</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {uploaderName && <span className="text-[11px] text-muted">{uploaderName}</span>}
              {uploaderName && createdAt && <span className="text-border text-[11px]">·</span>}
              {createdAt && <span className="text-[11px] text-muted">{formatRelative(createdAt)}</span>}
              {createdAt && sizeBytes > 0 && <span className="text-border text-[11px]">·</span>}
              {sizeBytes > 0 && <span className="text-[11px] text-muted">{formatBytes(sizeBytes)}</span>}
              {mimeLabel && (
                <>
                  <span className="text-border text-[11px]">·</span>
                  <span className="text-[10px] font-medium text-muted/60 bg-background border border-border rounded px-1.5 py-px">
                    {mimeLabel}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Preview body */}
        <div className="flex-1 min-h-0 flex flex-col" style={{ minHeight: "300px" }}>
          {loadingUrl ? (
            <div className="flex-1 flex items-center justify-center bg-[#F7F5F0]">
              <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin text-muted" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" strokeDasharray="40" strokeDashoffset="20" />
                </svg>
                <p className="text-xs text-muted">Loading…</p>
              </div>
            </div>
          ) : isDeleted ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#F7F5F0] p-8">
              <span className="text-3xl opacity-30">🗑️</span>
              <p className="text-sm text-muted text-center">This file has been deleted.</p>
              <p className="text-xs text-muted/60 text-center">The filename was <span className="font-medium text-foreground">{name}</span>.</p>
            </div>
          ) : urlError ? (
            <div className="flex-1 flex items-center justify-center bg-[#F7F5F0]">
              <p className="text-sm text-red-600">{urlError}</p>
            </div>
          ) : (
            <PreviewArea
              kind={kind}
              previewUrl={urls!.previewUrl}
              filename={name}
              sizeBytes={sizeBytes}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-t border-border shrink-0 bg-surface">
          {/* Download */}
          {urls ? (
            <a
              href={urls.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-background transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 1v6M2.5 5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M1 9.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Download
            </a>
          ) : (
            <div />
          )}

          {/* Delete area */}
          {onDeleted && (
            <div className="flex items-center gap-2">
              {deleteError && (
                <span className="text-xs text-red-600">{deleteError}</span>
              )}
              {confirmDelete ? (
                <>
                  <span className="text-xs text-red-600 font-medium">Permanently delete this file?</span>
                  <button
                    onClick={() => { setConfirmDelete(false); setDeleteError(null); }}
                    className="text-xs text-muted border border-border rounded-lg px-2.5 py-1.5 hover:bg-background transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                  >
                    {deleting ? (
                      <svg className="animate-spin" width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="10" />
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 3h8M4 3V2h4v1M5 5.5v3M7 5.5v3M3 3l.5 7h5L9 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    Delete permanently
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1 text-xs text-muted hover:text-red-600 border border-transparent hover:border-red-200 hover:bg-red-50 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 3h8M4 3V2h4v1M5 5.5v3M7 5.5v3M3 3l.5 7h5L9 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
