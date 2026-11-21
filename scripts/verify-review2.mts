/**
 * Review item ② checks (no network):
 * 1) Simulated LLM returns volatility -1% → fallback to default + reason
 * 2) 8/8 pending → all_pending tip, NOT too_strict
 * 3) usable data + 0 selected + excluded → too_strict
 */
import { applyLlmDraftPatches } from "../src/lib/clarify";
import { DEFAULT_CONDITIONS } from "../src/lib/defaults";
import { runScreen } from "../src/lib/engine";
import {
  SCREEN_TIP_TOO_STRICT,
  classifyScreenOutcome,
  withOutcomeAlert,
} from "../src/lib/screen-outcome";
import type { MetricId, MetricValue, StockSnapshot } from "../src/lib/types";

function miss(field: MetricId, label: string, unit: string): MetricValue {
  return {
    field,
    label,
    value: null,
    unit,
    asOf: "测试",
    source: "fixture",
    missingReason: "模拟数据缺失",
  };
}

function pendingStock(i: number): StockSnapshot {
  return {
    code: `TEST.${String(i).padStart(2, "0")}`,
    name: `待确认样例${i}`,
    industry: "测试",
    metrics: {
      revenue_yoy: miss("revenue_yoy", "营收同比", "%"),
      pe_ttm: miss("pe_ttm", "PE(TTM)", "倍"),
      volatility_20d: miss("volatility_20d", "近20日波动率", "%"),
    },
  };
}

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 1) Simulated model: volatility -1% ---
const draft = applyLlmDraftPatches({
  revenue_yoy: { op: ">", value: 0 },
  pe_ttm: { op: "between", value: 8, valueMax: 35 },
  volatility_20d: { op: "<", value: -1 },
});
const vol = draft.conditions.find((c) => c.id === "volatility_20d")!;
const defVol = DEFAULT_CONDITIONS.find((c) => c.id === "volatility_20d")!;
assert(vol.value === defVol.value, `volatility fell back to default ${defVol.value}, got ${vol.value}`);
assert(
  draft.draftNotes.some((n) => n.includes("超出允许范围") && n.includes("-1")),
  `draftNotes explain out-of-range -1: ${draft.draftNotes.join(" | ")}`,
);
assert(
  draft.draftNotes.some((n) => n.includes("已回退为默认")),
  "draftNotes mention fallback to default",
);

// --- 2) Eight stocks all pending ---
const pendingBundle = runScreen({
  stocks: Array.from({ length: 8 }, (_, i) => pendingStock(i + 1)),
  conditions: DEFAULT_CONDITIONS.map((c) => ({ ...c })),
  dataMode: "demo",
  asOf: "fixture",
  universeNote: "8 pending fixture",
  dataAlerts: ["fixture: 模拟 8 只全部字段缺失"],
});
assert(pendingBundle.counts.pending === 8, `pending=8 got ${pendingBundle.counts.pending}`);
assert(pendingBundle.counts.selected === 0, "selected=0");
assert(pendingBundle.counts.excluded === 0, "excluded=0");
const pendingOutcome = classifyScreenOutcome(pendingBundle.counts, pendingBundle.dataAlerts);
assert(pendingOutcome.kind === "all_pending", `kind=all_pending got ${pendingOutcome.kind}`);
assert(
  !!pendingOutcome.tip &&
    pendingOutcome.tip.includes("全部待确认") &&
    !pendingOutcome.tip.includes(SCREEN_TIP_TOO_STRICT),
  `all_pending tip without too_strict: ${pendingOutcome.tip}`,
);
const pendingAlerts = withOutcomeAlert([...pendingBundle.dataAlerts], pendingBundle.counts);
assert(
  pendingAlerts.some((a) => a.includes("全部待确认")),
  "withOutcomeAlert adds pending tip",
);
assert(
  !pendingAlerts.some((a) => a.includes(SCREEN_TIP_TOO_STRICT)),
  "withOutcomeAlert does NOT add too_strict for all-pending",
);

// --- 3) Usable data, zero hits ---
const strictOutcome = classifyScreenOutcome(
  { selected: 0, excluded: 8, pending: 0 },
  ["扶摇估值快照成功：8 只"],
);
assert(strictOutcome.kind === "too_strict", `kind=too_strict got ${strictOutcome.kind}`);
assert(strictOutcome.tip === SCREEN_TIP_TOO_STRICT, "too_strict tip text");

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nALL review② checks passed");
