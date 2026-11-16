import { NextResponse } from "next/server";
import {
  SortValidationError,
  applySort,
  planSort,
} from "@/lib/sort-files";

export const runtime = "nodejs";

type SortBody = {
  directory?: string;
  apply?: boolean;
};

export async function POST(request: Request) {
  let body: SortBody;
  try {
    body = (await request.json()) as SortBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const directory = body.directory?.trim();
  if (!directory) {
    return NextResponse.json(
      { error: "directory is required." },
      { status: 400 },
    );
  }

  const shouldApply = body.apply === true;

  try {
    if (shouldApply) {
      const result = await applySort(directory);
      return NextResponse.json({ ok: true, applied: true, ...result });
    }

    const plan = await planSort(directory);
    return NextResponse.json({ ok: true, applied: false, ...plan });
  } catch (err: unknown) {
    if (err instanceof SortValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}