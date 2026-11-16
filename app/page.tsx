"use client";

import { useMemo, useState } from "react";

type PlannedMove = {
  from: string;
  to: string;
  folder: string;
  renamed: boolean;
};

type PreviewResponse =
  | {
      ok: true;
      applied: false;
      moves: PlannedMove[];
      skipped: number;
    }
  | { error: string };

type ApplyResponse =
  | {
      ok: true;
      applied: true;
      moved: number;
      renamed: number;
      errors: { from: string; message: string }[];
    }
  | { error: string };

type PickResponse =
  | { status: "selected"; path: string }
  | { status: "cancelled" }
  | { status: "unsupported"; message: string }
  | { status: "error"; message: string };

export default function Home() {
  const [directory, setDirectory] = useState("");
  const [previewedFor, setPreviewedFor] = useState<string | null>(null);
  const [moves, setMoves] = useState<PlannedMove[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState<"pick" | "preview" | "sort" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResponse | null>(null);

  const groupedMoves = useMemo(() => {
    const groups = new Map<string, PlannedMove[]>();
    for (const move of moves) {
      const list = groups.get(move.folder) ?? [];
      list.push(move);
      groups.set(move.folder, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [moves]);

  const sortEnabled =
    directory.trim().length > 0 &&
    previewedFor === directory.trim() &&
    moves.length > 0;

  async function handlePickFolder() {
    setError(null);
    setApplyResult(null);
    setBusy("pick");
    try {
      const res = await fetch("/api/pick-folder", { method: "POST" });
      const data = (await res.json()) as PickResponse;
      if (!res.ok && "message" in data) {
        setError(data.message);
        return;
      }
      if (data.status === "selected") {
        setDirectory(data.path);
        setPreviewedFor(null);
        setMoves([]);
        setSkipped(0);
      } else if (data.status === "unsupported") {
        setError(data.message);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function handlePreview() {
    const path = directory.trim();
    if (!path) {
      setError("Enter or choose a folder path first.");
      return;
    }
    setError(null);
    setApplyResult(null);
    setBusy("preview");
    try {
      const res = await fetch("/api/sort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directory: path, apply: false }),
      });
      const data = (await res.json()) as PreviewResponse;
      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : "Preview failed.");
        setPreviewedFor(null);
        setMoves([]);
        return;
      }
      setMoves(data.moves);
      setSkipped(data.skipped);
      setPreviewedFor(path);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleSort() {
    const path = directory.trim();
    if (!sortEnabled) {
      return;
    }
    setError(null);
    setBusy("sort");
    try {
      const res = await fetch("/api/sort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directory: path, apply: true }),
      });
      const data = (await res.json()) as ApplyResponse;
      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : "Sort failed.");
        return;
      }
      setApplyResult(data);
      setMoves([]);
      setPreviewedFor(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6 md:p-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">File Sorter</h1>
        <p className="text-[var(--muted)]">
          Choose a folder on this computer. Files in that folder and its
          subfolders are moved into extension folders (for example{" "}
          <code className="rounded bg-white px-1.5 py-0.5 text-sm">PDF</code>,{" "}
          <code className="rounded bg-white px-1.5 py-0.5 text-sm">JPG</code>)
          created inside the folder you selected.
        </p>
      </header>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
        <label className="mb-2 block text-sm font-medium" htmlFor="directory">
          Folder path
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="directory"
            type="text"
            value={directory}
            onChange={(e) => {
              setDirectory(e.target.value);
              setPreviewedFor(null);
              setApplyResult(null);
            }}
            placeholder="/Users/you/Downloads"
            className="w-full flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={handlePickFolder}
            disabled={busy !== null}
            className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === "pick" ? "Opening…" : "Choose folder"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handlePreview}
            disabled={busy !== null || !directory.trim()}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {busy === "preview" ? "Previewing…" : "Preview moves"}
          </button>
          <button
            type="button"
            onClick={handleSort}
            disabled={busy !== null || !sortEnabled}
            className="rounded-lg bg-[var(--success)] px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {busy === "sort" ? "Sorting…" : "Sort files"}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        {applyResult && "ok" in applyResult && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
            Moved {applyResult.moved} file
            {applyResult.moved === 1 ? "" : "s"}
            {applyResult.renamed > 0
              ? ` (${applyResult.renamed} renamed for name collisions)`
              : ""}
            .
            {applyResult.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {applyResult.errors.map((e) => (
                  <li key={`${e.from}:${e.message}`}>
                    {e.from}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {previewedFor && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <h2 className="text-lg font-medium">Preview</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {moves.length} file{moves.length === 1 ? "" : "s"} to move
            {skipped > 0 ? `, ${skipped} already in the correct folder` : ""}.
          </p>

          {moves.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              Nothing to move in this folder.
            </p>
          ) : (
            <div className="mt-4 max-h-[28rem] space-y-4 overflow-y-auto">
              {groupedMoves.map(([folder, items]) => (
                <div key={folder}>
                  <h3 className="text-sm font-semibold text-slate-800">
                    {folder}/
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {items.map((move) => (
                      <li
                        key={`${move.from}->${move.to}`}
                        className="rounded-md bg-slate-50 px-2 py-1.5 font-mono text-xs leading-relaxed"
                      >
                        {move.from} → {move.to}
                        {move.renamed ? " (renamed)" : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}