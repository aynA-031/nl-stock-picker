import type { CompareOp, Condition, MetricId } from "./types";

export const METRIC_IDS: readonly MetricId[] = [
  "revenue_yoy",
  "pe_ttm",
  "volatility_20d",
] as const;

export const COMPARE_OPS: readonly CompareOp[] = [
  ">",
  ">=",
  "<",
  "<=",
  "between",
] as const;

/** Explicit numeric ranges for LLM draft thresholds (and soft guidance). */
export const LLM_THRESHOLD_RANGES: Record<
  MetricId,
  { min: number; max: number; unit: string; label: string }
> = {
  revenue_yoy: {
    min: -100,
    max: 500,
    unit: "%",
    label: "营收同比",
  },
  pe_ttm: {
    min: 0,
    max: 200,
    unit: "倍",
    label: "PE(TTM)",
  },
  volatility_20d: {
    // Upper bound must be positive; -1% is invalid and must fall back
    min: 0.1,
    max: 200,
    unit: "%",
    label: "近20日波动率上限",
  },
};

const METRIC_SET = new Set<string>(METRIC_IDS);
const OP_SET = new Set<string>(COMPARE_OPS);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function outOfRangeReason(metricId: MetricId, value: number, which: string): string | null {
  const range = LLM_THRESHOLD_RANGES[metricId];
  if (value < range.min || value > range.max) {
    return `${range.label} 的 ${which}=${value}${range.unit} 超出允许范围 [${range.min}, ${range.max}]${range.unit}`;
  }
  return null;
}

/** Validate one condition-like object. Returns a concrete error message or null if ok. */
export function validateCondition(
  raw: unknown,
  path: string,
): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return `${path} 必须是对象`;
  }
  const c = raw as Record<string, unknown>;

  if (typeof c.id !== "string" || !METRIC_SET.has(c.id)) {
    return `${path}.id 非法：必须是白名单指标（${METRIC_IDS.join(" / ")}），收到 ${JSON.stringify(c.id)}`;
  }
  const id = c.id as MetricId;

  if (c.field !== id) {
    return `${path}.field 必须与 id 一致（期望 "${id}"，收到 ${JSON.stringify(c.field)}）`;
  }

  if (typeof c.op !== "string" || !OP_SET.has(c.op)) {
    return `${path}.op 非法：必须是 ${COMPARE_OPS.map((o) => `"${o}"`).join(" / ")}，收到 ${JSON.stringify(c.op)}`;
  }
  const op = c.op as CompareOp;

  if (!isFiniteNumber(c.value)) {
    return `${path}.value 必须是有限数字，收到 ${JSON.stringify(c.value)}`;
  }

  if (op === "between") {
    if (!isFiniteNumber(c.valueMax)) {
      return `${path}.valueMax 在 op=between 时必须是有限数字，收到 ${JSON.stringify(c.valueMax)}`;
    }
    if (c.value > c.valueMax) {
      return `${path} 区间倒置：下限 value=${c.value} 大于上限 valueMax=${c.valueMax}`;
    }
  }

  if (typeof c.enabled !== "boolean") {
    return `${path}.enabled 必须是布尔值`;
  }

  return null;
}

/** Validate a conditions array. `label` is used in error paths (e.g. conditions / previousConditions). */
export function validateConditionsArray(
  raw: unknown,
  label: string,
): { ok: true; conditions: Condition[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: `${label} 必须是数组` };
  }
  if (raw.length === 0) {
    return { ok: false, error: `${label} 不能为空` };
  }
  const conditions: Condition[] = [];
  for (let i = 0; i < raw.length; i++) {
    const path = `${label}[${i}]`;
    const err = validateCondition(raw[i], path);
    if (err) return { ok: false, error: err };
    conditions.push(raw[i] as Condition);
  }
  return { ok: true, conditions };
}

/** Soft-check a numeric threshold patch from LLM; returns reason if invalid. */
export function invalidThresholdReason(
  metricId: MetricId,
  patch: { op?: unknown; value?: unknown; valueMax?: unknown },
): string | null {
  if (patch.op !== undefined) {
    if (typeof patch.op !== "string" || !OP_SET.has(patch.op)) {
      return `${metricId} 的 op 非法（${JSON.stringify(patch.op)}）`;
    }
  }
  if (patch.value !== undefined && !isFiniteNumber(patch.value)) {
    return `${metricId} 的 value 不是有限数字（${JSON.stringify(patch.value)}）`;
  }
  const op = (typeof patch.op === "string" && OP_SET.has(patch.op)
    ? patch.op
    : metricId === "pe_ttm"
      ? "between"
      : undefined) as CompareOp | undefined;

  if (op === "between" || (metricId === "pe_ttm" && patch.valueMax !== undefined)) {
    if (patch.valueMax !== undefined && !isFiniteNumber(patch.valueMax)) {
      return `${metricId} 的 valueMax 不是有限数字（${JSON.stringify(patch.valueMax)}）`;
    }
  }

  const value = isFiniteNumber(patch.value) ? patch.value : undefined;
  const valueMax = isFiniteNumber(patch.valueMax) ? patch.valueMax : undefined;
  const effectiveOp = op ?? (metricId === "pe_ttm" ? "between" : undefined);
  if (
    effectiveOp === "between" &&
    value !== undefined &&
    valueMax !== undefined &&
    value > valueMax
  ) {
    return `${metricId} 区间倒置（${value} > ${valueMax}）`;
  }

  if (value !== undefined) {
    const r = outOfRangeReason(metricId, value, "value");
    if (r) return r;
  }
  if (valueMax !== undefined) {
    const r = outOfRangeReason(metricId, valueMax, "valueMax");
    if (r) return r;
  }

  return null;
}

export function llmRangeHintForPrompt(): string {
  return (Object.keys(LLM_THRESHOLD_RANGES) as MetricId[])
    .map((id) => {
      const r = LLM_THRESHOLD_RANGES[id];
      return `- ${id}: ${r.label} 数值须在 [${r.min}, ${r.max}]${r.unit}`;
    })
    .join("\n");
}
