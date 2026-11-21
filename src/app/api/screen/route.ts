import { NextResponse } from "next/server";
import { runScreen } from "@/lib/engine";
import { loadMarketBundle } from "@/lib/fuyao";
import { getSnapshot, putSnapshot } from "@/lib/snapshot-cache";
import type { Condition } from "@/lib/types";
import { validateConditionsArray } from "@/lib/validate-conditions";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      conditions?: unknown;
      previousConditions?: unknown;
      previousSelectedCodes?: string[];
      snapshotId?: string;
    };

    const conditionsCheck = validateConditionsArray(body.conditions, "conditions");
    if (!conditionsCheck.ok) {
      return NextResponse.json(
        {
          error: conditionsCheck.error,
          note: "请求入参未通过校验，未执行筛选。",
        },
        { status: 400 },
      );
    }

    let previousConditionsValidated: Condition[] | undefined;
    if (body.previousConditions !== undefined && body.previousConditions !== null) {
      const prevCheck = validateConditionsArray(
        body.previousConditions,
        "previousConditions",
      );
      if (!prevCheck.ok) {
        return NextResponse.json(
          {
            error: prevCheck.error,
            note: "对比用 previousConditions 未通过校验，未执行筛选。",
          },
          { status: 400 },
        );
      }
      previousConditionsValidated = prevCheck.conditions;
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
      Array.isArray(previousConditionsValidated) &&
      previousConditionsValidated.length > 0;

    if (reused) {
      if (hasPreviousConditions) {
        const baseline = runScreen({
          stocks: bundle.stocks,
          conditions: previousConditionsValidated!,
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
      const baseline = runScreen({
        stocks: bundle.stocks,
        conditions: previousConditionsValidated!,
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
      conditions: conditionsCheck.conditions,
      dataMode: bundle.dataMode,
      asOf: bundle.asOf,
      universeNote: bundle.universeNote,
      dataAlerts: alerts,
      previousSelectedCodes,
    });

    // Soft tip for empty selection when data path itself looks healthy
    const dataFailed = alerts.some(
      (a) =>
        /失败|回退演示|缺少|无效|未配置|error|Error/i.test(a) &&
        !a.includes("同一数据快照") &&
        !a.includes("已刷新数据"),
    );
    if (result.counts.selected === 0 && !dataFailed) {
      alerts.push("当前股票池下没有命中，阈值可能过严");
      result.dataAlerts = alerts;
    }

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
