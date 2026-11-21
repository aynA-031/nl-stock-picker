export type MetricId = "revenue_yoy" | "pe_ttm" | "volatility_20d";

export type CompareOp = ">" | ">=" | "<" | "<=" | "between";

export type StockStatus = "selected" | "excluded" | "pending";

export type DataMode = "fuyao" | "demo";

export interface Condition {
  id: MetricId;
  label: string;
  description: string;
  field: MetricId;
  op: CompareOp;
  /** Primary threshold (for between: lower bound) */
  value: number;
  /** Upper bound when op === "between" */
  valueMax?: number;
  unit: string;
  enabled: boolean;
  sourceHint: string;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  options: string[];
  relatedMetric: MetricId;
}

export interface ConflictIssue {
  id: string;
  severity: "warning" | "error";
  message: string;
  relatedMetrics: MetricId[];
}

export interface ClarifyResult {
  intent: string;
  summary: string;
  questions: ClarificationQuestion[];
  conditions: Condition[];
  conflicts: ConflictIssue[];
  aiRoleNote: string;
  usedLlm: boolean;
  /** True when intent asks for guaranteed returns / buy advice */
  complianceBlocked?: boolean;
  complianceMessage?: string;
  /** Requested metrics not in MVP field set (shown in red on clarify card) */
  unsupportedAspects?: string[];
  /** Draft tips e.g. LLM threshold fallback to defaults */
  draftNotes?: string[];
}

export interface MetricValue {
  field: MetricId;
  label: string;
  value: number | null;
  unit: string;
  /** Display clock: report period / announce date / K-line cutoff */
  asOf: string;
  source: string;
  missingReason?: string;
  reportPeriod?: string;
  announceDate?: string;
}

export interface StockSnapshot {
  code: string;
  name: string;
  industry: string;
  metrics: Record<MetricId, MetricValue>;
}

export interface ConditionCheck {
  conditionId: MetricId;
  label: string;
  passed: boolean | null;
  actual: number | null;
  thresholdText: string;
  unit: string;
  asOf: string;
  source: string;
  reason: string;
}

export interface StockScreenResult {
  code: string;
  name: string;
  industry: string;
  status: StockStatus;
  checks: ConditionCheck[];
  summary: string;
}

export interface ScreenDelta {
  entered: Array<{ code: string; name: string }>;
  exited: Array<{ code: string; name: string }>;
  stillSelected: Array<{ code: string; name: string }>;
  note: string;
}

export interface ScreenResult {
  dataMode: DataMode;
  asOf: string;
  universeNote: string;
  /** Explicit data-source warnings (missing key, HTTP failure, empty payload, etc.) */
  dataAlerts: string[];
  disclaimer: string;
  conflicts: ConflictIssue[];
  results: StockScreenResult[];
  counts: {
    selected: number;
    excluded: number;
    pending: number;
  };
  delta?: ScreenDelta;
  /** Reuse this id on the next screen so delta uses the same market snapshot */
  snapshotId?: string;
}

export interface ScreenRequest {
  conditions: Condition[];
  /** Prior-round conditions; used to recompute baseline when snapshot cannot be reused */
  previousConditions?: Condition[];
  previousSelectedCodes?: string[];
  snapshotId?: string;
}
