import { NextResponse } from "next/server";
import { pickFolder } from "@/lib/pick-folder";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await pickFolder();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}