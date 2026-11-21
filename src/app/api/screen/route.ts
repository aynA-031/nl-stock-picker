import { NextResponse } from "next/server";
import { runScreen } from "@/lib/engine";
import { loadMarketBundle } from "@/lib/fuyao";
import { getSnapshot, putSnapshot } from "@/lib/snapshot-cache";
import type { Condition } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      conditions?: Condition[];
      previousSelectedCodes?: string[];
      snapshotId?: string;
    };

    if (!body.conditions || !Array.isArray(body.conditions)) {
      return NextResponse.json({ error: "缺少 conditions" }, { status: 400 });
    }

    let bundle = getSnapshot(body.snapshotId);
    let snapshotId = body.snapshotId;
    const reused = !!bundle;

    if (!bundle) {
      bundle = await loadMarketBundle();
      snapshotId = putSnapshot(bundle);
    }

    const alerts = [...bundle.fetchNotes];
    if (reused) {
      alerts.unshift(
        `名单对比使用同一数据快照（snapshotId=${snapshotId}），前后两轮行情/财务口径一致。`,
      );
    } else if (body.snapshotId) {
      alerts.unshift("上一快照已过期或不存在，已重新拉取数据并生成新快照。");
    }

    const result = runScreen({
      stocks: bundle.stocks,
      conditions: body.conditions,
      dataMode: bundle.dataMode,
      asOf: bundle.asOf,
      universeNote: bundle.universeNote,
      dataAlerts: alerts,
      previousSelectedCodes: body.previousSelectedCodes,
    });

    return NextResponse.json({ ...result, snapshotId });
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
