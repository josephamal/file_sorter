import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applySort,
  extensionFolderName,
  planSort,
} from "./sort-files";

const tempDirs: string[] = [];

async function makeTempRoot(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "file-sorter-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe("extensionFolderName", () => {
  it("uppercases extensions and uses OTHER when missing", () => {
    expect(extensionFolderName("a.PDF")).toBe("PDF");
    expect(extensionFolderName("noext")).toBe("OTHER");
    expect(extensionFolderName(".hidden")).toBe("OTHER");
  });
});

describe("planSort and applySort", () => {
  it("moves nested files into extension folders at the selected root", async () => {
    const root = await makeTempRoot();
    await fs.mkdir(path.join(root, "nested"));
    await fs.writeFile(path.join(root, "nested", "a.pdf"), "pdf");
    await fs.writeFile(path.join(root, "photo.JPG"), "jpg");

    const plan = await planSort(root);
    expect(plan.moves).toHaveLength(2);
    expect(plan.moves.map((m) => m.folder).sort()).toEqual(["JPG", "PDF"]);

    await applySort(root);

    await expect(fs.stat(path.join(root, "PDF", "a.pdf"))).resolves.toBeDefined();
    await expect(fs.stat(path.join(root, "JPG", "photo.JPG"))).resolves.toBeDefined();
  });

  it("skips files already in the correct root extension folder", async () => {
    const root = await makeTempRoot();
    await fs.mkdir(path.join(root, "PDF"));
    await fs.writeFile(path.join(root, "PDF", "keep.pdf"), "x");
    await fs.writeFile(path.join(root, "keep.pdf"), "y");

    const plan = await planSort(root);
    expect(plan.skipped).toBe(1);
    expect(plan.moves).toHaveLength(1);
    expect(path.basename(plan.moves[0].to)).toBe("keep_0.pdf");
    expect(plan.moves[0].renamed).toBe(true);
  });

  it("moves files from wrong extension folder and resolves _0 collisions", async () => {
    const root = await makeTempRoot();
    await fs.mkdir(path.join(root, "JPG"));
    await fs.mkdir(path.join(root, "PDF"));
    await fs.writeFile(path.join(root, "PDF", "report.pdf"), "existing");
    await fs.writeFile(path.join(root, "JPG", "report.pdf"), "wrong folder");
    await fs.mkdir(path.join(root, "sub"));
    await fs.writeFile(path.join(root, "sub", "report.pdf"), "nested");
    const plan = await planSort(root);
    const targets = plan.moves.map((m) => path.basename(m.to)).sort();
    expect(targets).toContain("report_0.pdf");
    expect(targets).toContain("report_1.pdf");

    await applySort(root);
    await expect(
      fs.stat(path.join(root, "PDF", "report.pdf")),
    ).resolves.toBeDefined();
    await expect(
      fs.stat(path.join(root, "PDF", "report_0.pdf")),
    ).resolves.toBeDefined();
    await expect(
      fs.stat(path.join(root, "PDF", "report_1.pdf")),
    ).resolves.toBeDefined();
  });
});