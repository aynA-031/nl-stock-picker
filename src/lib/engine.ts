import { detectConflicts, formatThreshold } from "./conflicts";
import { DISCLAIMER } from "./defaults";
import type {
  Condition,
  ConditionCheck,
  DataMode,
  MetricId,
  ScreenDelta,
  ScreenResult,
  StockScreenResult,
  StockSnapshot,
  StockStatus,
} from "./types";

function meets(op: Condition["op"], actual: number, value: number, valueMax?: number): boolean {
  switch (op) {
    case ">":
      return actual > value;
    case ">=":
      return actual >= value;
    case "<":
      return actual < value;
    case "<=":
      return actual <= value;
    case "between":
      return actual >= value && actual <= (valueMax ?? value);
    default:
      return false;
  }
}

function evaluateStock(stock: StockSnapshot, conditions: Condition[]): StockScreenResult {
  const enabled = conditions.filter((c) => c.enabled);
  const checks: ConditionCheck[] = enabled.map((condition) => {
    const metric = stock.metrics[condition.field];
    const thresholdText = formatThreshold(condition);

    if (!metric || metric.value === null) {
      return {
        conditionId: condition.id,
        label: condition.label,
        passed: null,
        actual: null,
        thresholdText,
        unit: condition.unit,
        asOf: metric?.asOf ?? "未知",
        source: metric?.source ?? "无",
        reason: metric?.missingReason ?? "数据缺失，无法判定该条件",
      };
    }

    const passed = meets(condition.op, metric.value, condition.value, condition.valueMax);
    return {
      conditionId: condition.id,
      label: condition.label,
      passed,
      actual: metric.value,
      thresholdText,
      unit: condition.unit,
      asOf: metric.asOf,
      source: metric.source,
      reason: passed
        ? `满足：实际值 ${metric.value}${condition.unit}，阈值 ${thresholdText}`
        : `不满足：实际值 ${metric.value}${condition.unit}，未达到阈值 ${thresholdText}`,
    };
  });

  const hasFail = checks.some((c) => c.passed === false);
  const hasMissing = checks.some((c) => c.passed === null);
  let status: StockStatus;
  let summary: string;

  if (hasFail) {
    status = "excluded";
    const failed = checks.filter((c) => c.passed === false).map((c) => c.label);
    summary = `排除：未满足 ${failed.join("、")}`;
  } else if (hasMissing) {
    status = "pending";
    const missing = checks.filter((c) => c.passed === null).map((c) => c.label);
    summary = `待确认：${missing.join("、")} 数据缺失，不能静默判定为通过`;
  } else {
    status = "selected";
    summary = "入选：已启用条件全部满足（基于可追溯字段值）";
  }

  return {
    code: stock.code,
    name: stock.name,
    industry: stock.industry,
    status,
    checks,
    summary,
  };
}

function buildDelta(
  current: StockScreenResult[],
  previousSelectedCodes?: string[],
): ScreenDelta | undefined {
  if (!previousSelectedCodes) return undefined;

  const prev = new Set(previousSelectedCodes);
  const selected = current.filter((r) => r.status === "selected");
  const selectedCodes = new Set(selected.map((r) => r.code));

  const entered = selected
    .filter((r) => !prev.has(r.code))
    .map((r) => ({ code: r.code, name: r.name }));
  const exited = [...prev]
    .filter((code) => !selectedCodes.has(code))
    .map((code) => {
      const hit = current.find((r) => r.code === code);
      return { code, name: hit?.name ?? code };
    });
  const stillSelected = selected
    .filter((r) => prev.has(r.code))
    .map((r) => ({ code: r.code, name: r.name }));

  return {
    entered,
    exited,
    stillSelected,
    note:
      entered.length === 0 && exited.length === 0
        ? "相对上一轮阈值，入选名单未变化。"
        : `相对上一轮：新进 ${entered.length} 只，退出 ${exited.length} 只。`,
  };
}

export function runScreen(params: {
  stocks: StockSnapshot[];
  conditions: Condition[];
  dataMode: DataMode;
  asOf: string;
  universeNote: string;
  dataAlerts?: string[];
  previousSelectedCodes?: string[];
}): ScreenResult {
  const conflicts = detectConflicts(params.conditions);
  const hardBlock = conflicts.some((c) => c.severity === "error" && c.id === "no_conditions");

  const results = hardBlock
    ? []
    : params.stocks
        .map((s) => evaluateStock(s, params.conditions))
        .sort((a, b) => {
          const order: Record<StockStatus, number> = {
            selected: 0,
            pending: 1,
            excluded: 2,
          };
          return order[a.status] - order[b.status] || a.code.localeCompare(b.code);
        });

  const counts = {
    selected: results.filter((r) => r.status === "selected").length,
    excluded: results.filter((r) => r.status === "excluded").length,
    pending: results.filter((r) => r.status === "pending").length,
  };

  return {
    dataMode: params.dataMode,
    asOf: params.asOf,
    universeNote: params.universeNote,
    dataAlerts: params.dataAlerts ?? [],
    disclaimer: DISCLAIMER,
    conflicts,
    results,
    counts,
    delta: buildDelta(results, params.previousSelectedCodes),
  };
}

export function metricLabel(id: MetricId): string {
  const map: Record<MetricId, string> = {
    revenue_yoy: "营收同比",
    pe_ttm: "PE(TTM)",
    volatility_20d: "近20日波动率",
  };
  return map[id];
}
