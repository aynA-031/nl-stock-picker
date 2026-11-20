import type { Condition, ConflictIssue } from "./types";

function get(conditions: Condition[], id: string): Condition | undefined {
  return conditions.find((c) => c.id === id && c.enabled);
}

/** Deterministic conflict detection — not LLM. */
export function detectConflicts(conditions: Condition[]): ConflictIssue[] {
  const issues: ConflictIssue[] = [];
  const revenue = get(conditions, "revenue_yoy");
  const pe = get(conditions, "pe_ttm");
  const vol = get(conditions, "volatility_20d");

  if (revenue && pe) {
    const peMax = pe.op === "between" ? pe.valueMax ?? pe.value : pe.value;
    const peMin = pe.op === "between" ? pe.value : pe.op === "<" || pe.op === "<=" ? undefined : pe.value;

    if (revenue.value >= 40 && peMax !== undefined && peMax <= 10) {
      issues.push({
        id: "growth_vs_cheap",
        severity: "warning",
        message:
          "高营收增速阈值（≥40%）与极低 PE 上限（≤10）同时启用，可能几乎筛不到股票；建议放宽估值或降低增速要求。",
        relatedMetrics: ["revenue_yoy", "pe_ttm"],
      });
    }

    if (pe.op === "between" && pe.valueMax !== undefined && pe.value > pe.valueMax) {
      issues.push({
        id: "pe_range_invalid",
        severity: "error",
        message: "PE(TTM) 下限大于上限，条件区间无效，筛选引擎将无法正常匹配。",
        relatedMetrics: ["pe_ttm"],
      });
    }

    if (peMin !== undefined && pe.op === ">" && pe.value >= 80) {
      issues.push({
        id: "pe_too_high_floor",
        severity: "warning",
        message: "PE 下限过高，与「估值合理」语义冲突，结果可能偏向高估值股票。",
        relatedMetrics: ["pe_ttm"],
      });
    }
  }

  if (vol && vol.value <= 8) {
    issues.push({
      id: "vol_too_tight",
      severity: "warning",
      message:
        "近 20 日年化波动率上限过低（≤8%），对 A 股个股通常过严，大量股票会因波动被排除。",
      relatedMetrics: ["volatility_20d"],
    });
  }

  if (revenue && vol && revenue.value >= 50 && vol.value <= 15) {
    issues.push({
      id: "growth_vs_stable",
      severity: "warning",
      message:
        "高增长与极低波动同时要求较严，二者在样本中常负相关，入选池可能很小。",
      relatedMetrics: ["revenue_yoy", "volatility_20d"],
    });
  }

  const enabled = conditions.filter((c) => c.enabled);
  if (enabled.length === 0) {
    issues.push({
      id: "no_conditions",
      severity: "error",
      message: "未启用任何条件，无法执行有意义的筛选。",
      relatedMetrics: [],
    });
  }

  return issues;
}

export function formatThreshold(condition: Condition): string {
  if (condition.op === "between") {
    return `${condition.value} ~ ${condition.valueMax ?? "?"} ${condition.unit}`;
  }
  return `${condition.op} ${condition.value} ${condition.unit}`;
}
