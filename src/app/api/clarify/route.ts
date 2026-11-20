import { NextResponse } from "next/server";
import { clarifyIntent } from "@/lib/clarify";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { intent?: string };
    const result = await clarifyIntent(body.intent ?? "");
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "澄清失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
