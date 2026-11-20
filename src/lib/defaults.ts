import type { Condition } from "./types";

/** Default draft for intent: 经营改善、估值合理、走势稳定 */
export const DEFAULT_CONDITIONS: Condition[] = [
  {
    id: "revenue_yoy",
    label: "经营改善 · 营收同比",
    description: "用最近报告期营业收入同比增速衡量经营是否改善",
    field: "revenue_yoy",
    op: ">",
    value: 0,
    unit: "%",
    enabled: true,
    sourceHint: "扶摇财务 / 演示财务",
  },
  {
    id: "pe_ttm",
    label: "估值合理 · PE(TTM)",
    description: "市盈率（TTM）落在可接受区间，避免过贵或异常低估",
    field: "pe_ttm",
    op: "between",
    value: 8,
    valueMax: 35,
    unit: "倍",
    enabled: true,
    sourceHint: "扶摇估值 / 演示估值",
  },
  {
    id: "volatility_20d",
    label: "走势稳定 · 近20日波动率",
    description: "近 20 个交易日收益率年化波动率上限，衡量走势相对稳定",
    field: "volatility_20d",
    op: "<",
    value: 35,
    unit: "%",
    enabled: true,
    sourceHint: "扶摇K线推算 / 演示波动率",
  },
];

export const DISCLAIMER =
  "本产品仅提供基于公开/接入数据的条件筛选与解释，不构成投资建议，不输出涨跌预测、收益承诺或买卖指令。事实（数据字段）与推断（条件草稿）已区分展示。";
