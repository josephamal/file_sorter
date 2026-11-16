import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type PickFolderResult =
  | { status: "selected"; path: string }
  | { status: "cancelled" }
  | { status: "unsupported"; message: string };

async function pickFolderMac(): Promise<PickFolderResult> {
  const script =
    'POSIX path of (choose folder with prompt "Select a folder to sort")';
  try {
    const { stdout } = await execFileAsync("osascript", ["-e", script], {
      timeout: 300_000,
    });
    const picked = stdout.trim();
    if (!picked) {
      return { status: "cancelled" };
    }
    return { status: "selected", path: picked };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("User canceled") ||
      message.includes("(-128)")
    ) {
      return { status: "cancelled" };
    }
    throw err;
  }
}

async function pickFolderWindows(): Promise<PickFolderResult> {
  const ps = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    '$dialog.Description = "Select a folder to sort"',
    '$dialog.ShowNewFolderButton = $true',
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
    "  Write-Output $dialog.SelectedPath",
    "}",
  ].join("; ");

  try {
    const { stdout } = await execFileAsync(
      "powershell",
      ["-NoProfile", "-STA", "-Command", ps],
      { timeout: 300_000, windowsHide: true },
    );
    const picked = stdout.trim();
    if (!picked) {
      return { status: "cancelled" };
    }
    return { status: "selected", path: picked };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("canceled") || message.includes("cancelled")) {
      return { status: "cancelled" };
    }
    throw err;
  }
}

export async function pickFolder(): Promise<PickFolderResult> {
  const platform = process.platform;
  if (platform === "darwin") {
    return pickFolderMac();
  }
  if (platform === "win32") {
    return pickFolderWindows();
  }
  return {
    status: "unsupported",
    message:
      "Native folder picker is only supported on macOS and Windows. Paste a folder path instead.",
  };
}