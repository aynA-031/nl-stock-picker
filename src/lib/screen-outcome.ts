import type { ScreenResult } from "./types";

/** Shared empty-selection / notice classification for API + UI. */
export const SCREEN_TIP_TOO_STRICT = "当前股票池下没有命中，阈值可能过严";

export function tipPendingRemain(n: number): string {
  return `暂无确认入选，仍有 ${n} 只因数据不足待确认`;
}

export type ScreenOutcomeKind =
  | "has_hits"
  | "too_strict"
  | "has_pending"
  | "data_unavailable";

export interface ScreenOutcome {
  kind: ScreenOutcomeKind;
  /** Short tip suitable for dataAlerts / page notice */
  tip: string | null;
}

function looksLikeDataFailure(alerts: string[] | undefined): boolean {
  if (!alerts?.length) return false;
  return alerts.some((a) => {
    if (a.includes("同一数据快照") || a.includes("已刷新数据")) return false;
    if (a.includes(SCREEN_TIP_TOO_STRICT)) return false;
    if (a.includes("暂无确认入选") || a.includes("全部待确认")) return false;
    return /失败|回退演示|缺少|未配置|无效密钥|接口异常|error/i.test(a);
  });
}

/**
 * Decide why selection is empty (or not).
 * - 0 入选且仍有待确认 →「暂无确认入选，仍有 N 只因数据不足待确认」
 * - 仅当 0 入选且 0 待确认 →「阈值可能过严」
 */
export function classifyScreenOutcome(
  counts: ScreenResult["counts"],
  dataAlerts?: string[],
): ScreenOutcome {
  if (counts.selected > 0) {
    return { kind: "has_hits", tip: null };
  }

  if (looksLikeDataFailure(dataAlerts)) {
    const failureNotes = (dataAlerts ?? []).filter(
      (a) =>
        /失败|回退演示|缺少|未配置|无效|接口异常/i.test(a) &&
        !a.includes("同一数据快照") &&
        !a.includes("已刷新数据"),
    );
    return {
      kind: "data_unavailable",
      tip: failureNotes[0] ?? "数据不可用或接口失败，无法完成可靠筛选",
    };
  }

  const total = counts.selected + counts.excluded + counts.pending;
  if (total === 0) {
    return {
      kind: "data_unavailable",
      tip: "股票池为空或无可筛选标的，请检查数据源",
    };
  }

  // Any pending while none selected → data-insufficiency tip (not too-strict)
  if (counts.pending > 0) {
    return {
      kind: "has_pending",
      tip: tipPendingRemain(counts.pending),
    };
  }

  // selected === 0 && pending === 0
  return { kind: "too_strict", tip: SCREEN_TIP_TOO_STRICT };
}

/** Append outcome tip into alerts (idempotent). */
export function withOutcomeAlert(
  alerts: string[],
  counts: ScreenResult["counts"],
): string[] {
  const outcome = classifyScreenOutcome(counts, alerts);
  if (!outcome.tip) return alerts;
  if (alerts.some((a) => a.includes(outcome.tip!) || a === outcome.tip)) {
    return alerts;
  }

  const withoutOldTips = alerts.filter(
    (a) =>
      !a.includes(SCREEN_TIP_TOO_STRICT) &&
      !a.includes("暂无确认入选") &&
      !a.includes("全部待确认"),
  );

  if (outcome.kind === "has_pending" || outcome.kind === "too_strict") {
    return [...withoutOldTips, outcome.tip];
  }
  if (outcome.kind === "data_unavailable") {
    return alerts.some((a) => a.includes(outcome.tip!))
      ? alerts
      : [...alerts, outcome.tip];
  }
  return alerts;
}
