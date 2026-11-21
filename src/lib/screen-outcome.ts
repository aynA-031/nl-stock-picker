import type { ScreenResult } from "./types";

/** Shared empty-selection / notice classification for API + UI. */
export const SCREEN_TIP_TOO_STRICT = "当前股票池下没有命中，阈值可能过严";
export const SCREEN_TIP_ALL_PENDING =
  "股票池内标的全部为待确认（数据缺失或字段不足），无法判定是否命中；请检查数据源或稍后重试";

export type ScreenOutcomeKind =
  | "has_hits"
  | "too_strict"
  | "all_pending"
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
    if (a.includes(SCREEN_TIP_TOO_STRICT) || a.includes(SCREEN_TIP_ALL_PENDING)) {
      return false;
    }
    return /失败|回退演示|缺少|未配置|无效密钥|接口异常|error/i.test(a);
  });
}

/**
 * Decide why selection is empty (or not).
 * 「阈值可能过严」仅在：数据可用，且确有可判定结果但无入选（存在 excluded）时。
 * 若全部待确认，则提示数据缺失/待确认，不提示过严。
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

  // All pending (e.g. 8/8)：数据缺失主导，不是阈值过严
  if (counts.pending > 0 && counts.excluded === 0 && counts.selected === 0) {
    return {
      kind: "all_pending",
      tip: `当前股票池 ${counts.pending} 只全部待确认（数据缺失或字段不足），无法判定是否命中；请检查数据源或稍后重试`,
    };
  }

  // Data usable: at least some stocks were excluded by conditions
  if (counts.excluded > 0) {
    return { kind: "too_strict", tip: SCREEN_TIP_TOO_STRICT };
  }

  return {
    kind: "data_unavailable",
    tip: "未能形成可判定结果，请检查数据源",
  };
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
  // Prefer not stacking too_strict if we already decided all_pending
  if (outcome.kind === "all_pending") {
    return [
      ...alerts.filter((a) => !a.includes(SCREEN_TIP_TOO_STRICT)),
      outcome.tip,
    ];
  }
  if (outcome.kind === "too_strict") {
    return [...alerts, outcome.tip];
  }
  if (outcome.kind === "data_unavailable") {
    // failure notes usually already present; only add if missing
    return alerts.some((a) => a.includes(outcome.tip!))
      ? alerts
      : [...alerts, outcome.tip];
  }
  return alerts;
}
