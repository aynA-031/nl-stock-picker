import { NextResponse } from "next/server";
import { runScreen } from "@/lib/engine";
import { loadMarketBundle } from "@/lib/fuyao";
import type { Condition } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      conditions?: Condition[];
      previousSelectedCodes?: string[];
    };

    if (!body.conditions || !Array.isArray(body.conditions)) {
      return NextResponse.json({ error: "缺少 conditions" }, { status: 400 });
    }

    const bundle = await loadMarketBundle();
    const result = runScreen({
      stocks: bundle.stocks,
      conditions: body.conditions,
      dataMode: bundle.dataMode,
      asOf: bundle.asOf,
      universeNote: bundle.universeNote,
      dataAlerts: bundle.fetchNotes,
      previousSelectedCodes: body.previousSelectedCodes,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "筛选失败";
    return NextResponse.json(
      {
        error: message,
        note: "接口异常已显式返回，未生成虚假正常结论。",
      },
      { status: 500 },
    );
  }
}
