import type { MetricId, MetricValue, StockSnapshot } from "./types";

const AS_OF = "2026-11-19";
const SOURCE = "演示数据（非扶摇实时）";

function m(
  field: MetricId,
  label: string,
  value: number | null,
  unit: string,
  missingReason?: string,
): MetricValue {
  return {
    field,
    label,
    value,
    unit,
    asOf: AS_OF,
    source: SOURCE,
    missingReason,
  };
}

/** Small A-share-like demo universe for offline / no-key runs. */
export const DEMO_STOCKS: StockSnapshot[] = [
  {
    code: "600519.SH",
    name: "贵州茅台",
    industry: "白酒",
    metrics: {
      revenue_yoy: m("revenue_yoy", "营收同比", 12.5, "%"),
      pe_ttm: m("pe_ttm", "PE(TTM)", 28.4, "倍"),
      volatility_20d: m("volatility_20d", "近20日波动率", 18.2, "%"),
    },
  },
  {
    code: "000858.SZ",
    name: "五粮液",
    industry: "白酒",
    metrics: {
      revenue_yoy: m("revenue_yoy", "营收同比", 8.1, "%"),
      pe_ttm: m("pe_ttm", "PE(TTM)", 22.0, "倍"),
      volatility_20d: m("volatility_20d", "近20日波动率", 21.5, "%"),
    },
  },
  {
    code: "601318.SH",
    name: "中国平安",
    industry: "保险",
    metrics: {
      revenue_yoy: m("revenue_yoy", "营收同比", 5.6, "%"),
      pe_ttm: m("pe_ttm", "PE(TTM)", 9.8, "倍"),
      volatility_20d: m("volatility_20d", "近20日波动率", 24.0, "%"),
    },
  },
  {
    code: "600036.SH",
    name: "招商银行",
    industry: "银行",
    metrics: {
      revenue_yoy: m("revenue_yoy", "营收同比", 3.2, "%"),
      pe_ttm: m("pe_ttm", "PE(TTM)", 7.5, "倍"),
      volatility_20d: m("volatility_20d", "近20日波动率", 16.8, "%"),
    },
  },
  {
    code: "300750.SZ",
    name: "宁德时代",
    industry: "电池",
    metrics: {
      revenue_yoy: m("revenue_yoy", "营收同比", 18.7, "%"),
      pe_ttm: m("pe_ttm", "PE(TTM)", 26.1, "倍"),
      volatility_20d: m("volatility_20d", "近20日波动率", 42.3, "%"),
    },
  },
  {
    code: "002594.SZ",
    name: "比亚迪",
    industry: "汽车",
    metrics: {
      revenue_yoy: m("revenue_yoy", "营收同比", 24.0, "%"),
      pe_ttm: m("pe_ttm", "PE(TTM)", 31.2, "倍"),
      volatility_20d: m("volatility_20d", "近20日波动率", 38.9, "%"),
    },
  },
  {
    code: "601012.SH",
    name: "隆基绿能",
    industry: "光伏",
    metrics: {
      revenue_yoy: m("revenue_yoy", "营收同比", -12.4, "%"),
      pe_ttm: m("pe_ttm", "PE(TTM)", 45.0, "倍"),
      volatility_20d: m("volatility_20d", "近20日波动率", 48.1, "%"),
    },
  },
  {
    code: "600276.SH",
    name: "恒瑞医药",
    industry: "医药",
    metrics: {
      revenue_yoy: m("revenue_yoy", "营收同比", 14.3, "%"),
      pe_ttm: m("pe_ttm", "PE(TTM)", 33.5, "倍"),
      volatility_20d: m("volatility_20d", "近20日波动率", 27.4, "%"),
    },
  },
  {
    code: "000001.SZ",
    name: "平安银行",
    industry: "银行",
    metrics: {
      revenue_yoy: m("revenue_yoy", "营收同比", -1.8, "%"),
      pe_ttm: m("pe_ttm", "PE(TTM)", 5.2, "倍"),
      volatility_20d: m("volatility_20d", "近20日波动率", 19.6, "%"),
    },
  },
  {
    code: "688981.SH",
    name: "中芯国际",
    industry: "半导体",
    metrics: {
      revenue_yoy: m("revenue_yoy", "营收同比", 21.0, "%"),
      pe_ttm: m("pe_ttm", "PE(TTM)", 62.0, "倍"),
      volatility_20d: m("volatility_20d", "近20日波动率", 44.5, "%"),
    },
  },
  {
    code: "603288.SH",
    name: "海天味业",
    industry: "食品",
    metrics: {
      revenue_yoy: m("revenue_yoy", "营收同比", 11.2, "%"),
      pe_ttm: m("pe_ttm", "PE(TTM)", 29.8, "倍"),
      volatility_20d: m("volatility_20d", "近20日波动率", 17.1, "%"),
    },
  },
  {
    code: "600900.SH",
    name: "长江电力",
    industry: "电力",
    metrics: {
      revenue_yoy: m("revenue_yoy", "营收同比", 6.4, "%"),
      pe_ttm: m("pe_ttm", "PE(TTM)", 18.6, "倍"),
      volatility_20d: m("volatility_20d", "近20日波动率", 12.5, "%"),
    },
  },
  {
    code: "002415.SZ",
    name: "海康威视",
    industry: "安防",
    metrics: {
      revenue_yoy: m("revenue_yoy", "营收同比", 9.5, "%"),
      pe_ttm: m("pe_ttm", "PE(TTM)", 19.2, "倍"),
      volatility_20d: m("volatility_20d", "近20日波动率", 29.0, "%"),
    },
  },
  {
    code: "600030.SH",
    name: "中信证券",
    industry: "证券",
    metrics: {
      revenue_yoy: m("revenue_yoy", "营收同比", 15.8, "%"),
      pe_ttm: m("pe_ttm", "PE(TTM)", 14.1, "倍"),
      volatility_20d: m("volatility_20d", "近20日波动率", 33.2, "%"),
    },
  },
  {
    code: "DEMO.MISS",
    name: "数据缺失示例",
    industry: "演示",
    metrics: {
      revenue_yoy: m(
        "revenue_yoy",
        "营收同比",
        null,
        "%",
        "演示：最近报告期营收字段未返回，无法判定经营改善",
      ),
      pe_ttm: m("pe_ttm", "PE(TTM)", 16.0, "倍"),
      volatility_20d: m("volatility_20d", "近20日波动率", 22.0, "%"),
    },
  },
];

export const DEMO_META = {
  asOf: AS_OF,
  universeNote: "演示股票池（15 只），用于无扶摇 Key 时跑通主链路；结果已标注为演示数据。",
  dataMode: "demo" as const,
};
