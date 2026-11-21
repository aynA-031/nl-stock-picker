import type { MetricId } from "./types";

export interface UnsupportedHit {
  /** Short label shown in UI, e.g. ROE */
  label: string;
  /** Matched fragment for debugging */
  matched: string;
}

/** Aspects this product can screen today. */
export function detectSupportedMetrics(intent: string): MetricId[] {
  const found = new Set<MetricId>();
  if (/营收|经营改善|经营|同比增速|收入增长|高增长/.test(intent)) {
    found.add("revenue_yoy");
  }
  if (/估值|市盈率|PE|pe\b|合理估值|低估/.test(intent)) {
    found.add("pe_ttm");
  }
  if (/波动|走势稳定|稳定|低波动|年化波动/.test(intent)) {
    found.add("volatility_20d");
  }
  return [...found];
}

/**
 * Detect requested metrics that are not in the MVP field set.
 * Used to populate ClarifyResult.unsupportedAspects.
 */
export function detectUnsupportedAspects(intent: string): string[] {
  const rules: Array<{ label: string; re: RegExp }> = [
    { label: "ROE（净资产收益率）", re: /ROE|净资产收益率/i },
    { label: "负债率 / 资产负债率", re: /负债率|资产负债率|杠杆率/ },
    { label: "分红 / 股息", re: /分红|股息|股利|派息|连续分红/ },
    { label: "市净率（PB）", re: /市净率|\bPB\b|pb\b/i },
    { label: "毛利率", re: /毛利率/ },
    { label: "现金流", re: /现金流|经营性现金流|自由现金流/ },
    { label: "市值 / 成交额", re: /市值|成交额|换手率/ },
  ];

  const hits: string[] = [];
  for (const rule of rules) {
    if (rule.re.test(intent)) hits.push(rule.label);
  }
  return hits;
}

/** True when intent looks like the generic three-pillar MVP prompt. */
export function isGenericSupportedIntent(intent: string): boolean {
  return /经营改善.*估值合理.*走势稳定|估值合理.*经营改善|走势稳定.*估值/.test(
    intent,
  );
}
