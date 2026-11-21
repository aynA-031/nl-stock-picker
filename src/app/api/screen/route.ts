import { NextResponse } from "next/server";
import { runScreen } from "@/lib/engine";
import { loadMarketBundle } from "@/lib/fuyao";
import { getSnapshot, putSnapshot } from "@/lib/snapshot-cache";
import type { Condition } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      conditions?: Condition[];
      previousConditions?: Condition[];
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
    let previousSelectedCodes = body.previousSelectedCodes;
    const hasPreviousConditions =
      Array.isArray(body.previousConditions) && body.previousConditions.length > 0;

    if (reused) {
      // Same snapshot: optionally recompute baseline from previous conditions for consistency
      if (hasPreviousConditions) {
        const baseline = runScreen({
          stocks: bundle.stocks,
          conditions: body.previousConditions!,
          dataMode: bundle.dataMode,
          asOf: bundle.asOf,
          universeNote: bundle.universeNote,
          dataAlerts: [],
        });
        previousSelectedCodes = baseline.results
          .filter((r) => r.status === "selected")
          .map((r) => r.code);
      }
      alerts.unshift(
        `名单对比使用同一数据快照（snapshotId=${snapshotId}），前后两轮行情/财务口径一致。`,
      );
    } else if (hasPreviousConditions) {
      // Snapshot missing/expired (common on serverless): one new fetch, run BOTH condition sets
      const baseline = runScreen({
        stocks: bundle.stocks,
        conditions: body.previousConditions!,
        dataMode: bundle.dataMode,
        asOf: bundle.asOf,
        universeNote: bundle.universeNote,
        dataAlerts: [],
      });
      previousSelectedCodes = baseline.results
        .filter((r) => r.status === "selected")
        .map((r) => r.code);
      alerts.unshift("已刷新数据，前后条件均按新快照重算");
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
      previousSelectedCodes,
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
