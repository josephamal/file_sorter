import fs from "fs/promises";
import path from "path";

const IGNORED_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

export type PlannedMove = {
  from: string;
  to: string;
  folder: string;
  renamed: boolean;
};

export type SortPlanResult = {
  moves: PlannedMove[];
  skipped: number;
};

export type SortApplyResult = {
  moved: number;
  renamed: number;
  errors: { from: string; message: string }[];
};

export class SortValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SortValidationError";
  }
}

export function extensionFolderName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0 || dot === fileName.length - 1) {
    return "OTHER";
  }
  return fileName.slice(dot + 1).toUpperCase();
}

export function isFilesystemRoot(dirPath: string): boolean {
  const resolved = path.resolve(dirPath);
  if (process.platform === "win32") {
    return /^[A-Za-z]:[\\/]?$/i.test(resolved);
  }
  return resolved === path.parse(resolved).root;
}

export function isPathInside(child: string, parent: string): boolean {
  const parentResolved = path.resolve(parent);
  const childResolved = path.resolve(child);
  if (childResolved === parentResolved) {
    return true;
  }
  const rel = path.relative(parentResolved, childResolved);
  return rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

async function assertValidDirectory(directory: string): Promise<string> {
  const resolved = path.resolve(directory);
  if (isFilesystemRoot(resolved)) {
    throw new SortValidationError("Cannot sort a filesystem root directory.");
  }
  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch {
    throw new SortValidationError("Directory does not exist.");
  }
  if (!stat.isDirectory()) {
    throw new SortValidationError("Path is not a directory.");
  }
  return fs.realpath(resolved);
}

async function walkFiles(directory: string, out: string[]): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      await walkFiles(fullPath, out);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (IGNORED_FILES.has(entry.name)) {
      continue;
    }
    out.push(fullPath);
  }
}

async function listFileBasenames(dir: string): Promise<Set<string>> {
  const names = new Set<string>();
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        names.add(entry.name);
      }
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw err;
    }
  }
  return names;
}

function allocateFileName(
  originalBase: string,
  onDisk: Set<string>,
  reserved: Set<string>,
): { name: string; renamed: boolean } {
  if (!onDisk.has(originalBase) && !reserved.has(originalBase)) {
    reserved.add(originalBase);
    return { name: originalBase, renamed: false };
  }

  const ext = path.extname(originalBase);
  const stem = path.basename(originalBase, ext);

  let index = 0;
  while (true) {
    const candidate = `${stem}_${index}${ext}`;
    if (!onDisk.has(candidate) && !reserved.has(candidate)) {
      reserved.add(candidate);
      return { name: candidate, renamed: true };
    }
    index += 1;
  }
}

export async function planSort(directory: string): Promise<SortPlanResult> {
  const root = await assertValidDirectory(directory);
  const allFiles: string[] = [];
  await walkFiles(root, allFiles);

  const perFolderOnDisk = new Map<string, Set<string>>();
  const perFolderReserved = new Map<string, Set<string>>();

  const moves: PlannedMove[] = [];
  let skipped = 0;

  for (const filePath of allFiles) {
    const realPath = await fs.realpath(filePath).catch(() => filePath);
    if (!isPathInside(realPath, root)) {
      continue;
    }

    const base = path.basename(filePath);
    const folder = extensionFolderName(base);
    const targetDir = path.join(root, folder);

    if (path.resolve(path.dirname(filePath)) === path.resolve(targetDir)) {
      skipped += 1;
      continue;
    }

    if (!perFolderOnDisk.has(folder)) {
      perFolderOnDisk.set(folder, await listFileBasenames(targetDir));
      perFolderReserved.set(folder, new Set());
    }

    const onDisk = perFolderOnDisk.get(folder)!;
    const reserved = perFolderReserved.get(folder)!;
    const { name, renamed } = allocateFileName(base, onDisk, reserved);
    const targetPath = path.join(targetDir, name);

    moves.push({
      from: filePath,
      to: targetPath,
      folder,
      renamed,
    });
  }

  return { moves, skipped };
}

async function moveFile(from: string, to: string): Promise<void> {
  await fs.mkdir(path.dirname(to), { recursive: true });
  try {
    await fs.rename(from, to);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EXDEV") {
      await fs.copyFile(from, to);
      await fs.unlink(from);
      return;
    }
    throw err;
  }
}

export async function applySort(directory: string): Promise<SortApplyResult> {
  const { moves } = await planSort(directory);
  let moved = 0;
  let renamed = 0;
  const errors: { from: string; message: string }[] = [];

  for (const move of moves) {
    try {
      await moveFile(move.from, move.to);
      moved += 1;
      if (move.renamed) {
        renamed += 1;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ from: move.from, message });
    }
  }

  return { moved, renamed, errors };
}