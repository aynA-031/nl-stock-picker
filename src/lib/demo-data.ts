import type { MetricId, MetricValue, StockSnapshot } from "./types";

const PE_ASOF = "估值快照时点 2026-11-19";
const SOURCE = "演示数据（非扶摇实时）";

function m(
  field: MetricId,
  label: string,
  value: number | null,
  unit: string,
  asOf: string,
  extra?: { missingReason?: string; reportPeriod?: string; announceDate?: string },
): MetricValue {
  return {
    field,
    label,
    value,
    unit,
    asOf,
    source: SOURCE,
    missingReason: extra?.missingReason,
    reportPeriod: extra?.reportPeriod,
    announceDate: extra?.announceDate,
  };
}

function revenue(value: number | null, missingReason?: string): MetricValue {
  return m(
    "revenue_yoy",
    "营收同比",
    value,
    "%",
    missingReason
      ? "报告期 2025年报（2025-4）"
      : "报告期 2025年报（2025-4）；公告日 2026-03-28",
    {
      missingReason,
      reportPeriod: "2025-4",
      announceDate: missingReason ? undefined : "2026-03-28",
    },
  );
}

/** Small A-share-like demo universe for offline / no-key runs. */
export const DEMO_STOCKS: StockSnapshot[] = [
  {
    code: "600519.SH",
    name: "贵州茅台",
    industry: "白酒",
    metrics: {
      revenue_yoy: revenue(12.5),
      pe_ttm: m("pe_ttm", "PE(TTM)", 28.4, "倍", PE_ASOF),
      volatility_20d: m(
        "volatility_20d",
        "近20日波动率",
        18.2,
        "%",
        "近20个交易日波动率；K线截止 2026-11-19（基于21个有效收盘价）",
      ),
    },
  },
  {
    code: "000858.SZ",
    name: "五粮液",
    industry: "白酒",
    metrics: {
      revenue_yoy: revenue(8.1),
      pe_ttm: m("pe_ttm", "PE(TTM)", 22.0, "倍", PE_ASOF),
      volatility_20d: m(
        "volatility_20d",
        "近20日波动率",
        21.5,
        "%",
        "近20个交易日波动率；K线截止 2026-11-19（基于21个有效收盘价）",
      ),
    },
  },
  {
    code: "601318.SH",
    name: "中国平安",
    industry: "保险",
    metrics: {
      revenue_yoy: revenue(5.6),
      pe_ttm: m("pe_ttm", "PE(TTM)", 9.8, "倍", PE_ASOF),
      volatility_20d: m(
        "volatility_20d",
        "近20日波动率",
        24.0,
        "%",
        "近20个交易日波动率；K线截止 2026-11-19（基于21个有效收盘价）",
      ),
    },
  },
  {
    code: "600036.SH",
    name: "招商银行",
    industry: "银行",
    metrics: {
      revenue_yoy: revenue(3.2),
      pe_ttm: m("pe_ttm", "PE(TTM)", 7.5, "倍", PE_ASOF),
      volatility_20d: m(
        "volatility_20d",
        "近20日波动率",
        16.8,
        "%",
        "近20个交易日波动率；K线截止 2026-11-19（基于21个有效收盘价）",
      ),
    },
  },
  {
    code: "300750.SZ",
    name: "宁德时代",
    industry: "电池",
    metrics: {
      revenue_yoy: revenue(18.7),
      pe_ttm: m("pe_ttm", "PE(TTM)", 26.1, "倍", PE_ASOF),
      volatility_20d: m(
        "volatility_20d",
        "近20日波动率",
        42.3,
        "%",
        "近20个交易日波动率；K线截止 2026-11-19（基于21个有效收盘价）",
      ),
    },
  },
  {
    code: "002594.SZ",
    name: "比亚迪",
    industry: "汽车",
    metrics: {
      revenue_yoy: revenue(24.0),
      pe_ttm: m("pe_ttm", "PE(TTM)", 31.2, "倍", PE_ASOF),
      volatility_20d: m(
        "volatility_20d",
        "近20日波动率",
        38.9,
        "%",
        "近20个交易日波动率；K线截止 2026-11-19（基于21个有效收盘价）",
      ),
    },
  },
  {
    code: "601012.SH",
    name: "隆基绿能",
    industry: "光伏",
    metrics: {
      revenue_yoy: revenue(-12.4),
      pe_ttm: m("pe_ttm", "PE(TTM)", 45.0, "倍", PE_ASOF),
      volatility_20d: m(
        "volatility_20d",
        "近20日波动率",
        48.1,
        "%",
        "近20个交易日波动率；K线截止 2026-11-19（基于21个有效收盘价）",
      ),
    },
  },
  {
    code: "600276.SH",
    name: "恒瑞医药",
    industry: "医药",
    metrics: {
      revenue_yoy: revenue(14.3),
      pe_ttm: m("pe_ttm", "PE(TTM)", 33.5, "倍", PE_ASOF),
      volatility_20d: m(
        "volatility_20d",
        "近20日波动率",
        27.4,
        "%",
        "近20个交易日波动率；K线截止 2026-11-19（基于21个有效收盘价）",
      ),
    },
  },
  {
    code: "000001.SZ",
    name: "平安银行",
    industry: "银行",
    metrics: {
      revenue_yoy: revenue(-1.8),
      pe_ttm: m("pe_ttm", "PE(TTM)", 5.2, "倍", PE_ASOF),
      volatility_20d: m(
        "volatility_20d",
        "近20日波动率",
        19.6,
        "%",
        "近20个交易日波动率；K线截止 2026-11-19（基于21个有效收盘价）",
      ),
    },
  },
  {
    code: "688981.SH",
    name: "中芯国际",
    industry: "半导体",
    metrics: {
      revenue_yoy: revenue(21.0),
      pe_ttm: m("pe_ttm", "PE(TTM)", 62.0, "倍", PE_ASOF),
      volatility_20d: m(
        "volatility_20d",
        "近20日波动率",
        44.5,
        "%",
        "近20个交易日波动率；K线截止 2026-11-19（基于21个有效收盘价）",
      ),
    },
  },
  {
    code: "603288.SH",
    name: "海天味业",
    industry: "食品",
    metrics: {
      revenue_yoy: revenue(11.2),
      pe_ttm: m("pe_ttm", "PE(TTM)", 29.8, "倍", PE_ASOF),
      volatility_20d: m(
        "volatility_20d",
        "近20日波动率",
        17.1,
        "%",
        "近20个交易日波动率；K线截止 2026-11-19（基于21个有效收盘价）",
      ),
    },
  },
  {
    code: "600900.SH",
    name: "长江电力",
    industry: "电力",
    metrics: {
      revenue_yoy: revenue(6.4),
      pe_ttm: m("pe_ttm", "PE(TTM)", 18.6, "倍", PE_ASOF),
      volatility_20d: m(
        "volatility_20d",
        "近20日波动率",
        12.5,
        "%",
        "近20个交易日波动率；K线截止 2026-11-19（基于21个有效收盘价）",
      ),
    },
  },
  {
    code: "002415.SZ",
    name: "海康威视",
    industry: "安防",
    metrics: {
      revenue_yoy: revenue(9.5),
      pe_ttm: m("pe_ttm", "PE(TTM)", 19.2, "倍", PE_ASOF),
      volatility_20d: m(
        "volatility_20d",
        "近20日波动率",
        29.0,
        "%",
        "近20个交易日波动率；K线截止 2026-11-19（基于21个有效收盘价）",
      ),
    },
  },
  {
    code: "600030.SH",
    name: "中信证券",
    industry: "证券",
    metrics: {
      revenue_yoy: revenue(15.8),
      pe_ttm: m("pe_ttm", "PE(TTM)", 14.1, "倍", PE_ASOF),
      volatility_20d: m(
        "volatility_20d",
        "近20日波动率",
        33.2,
        "%",
        "近20个交易日波动率；K线截止 2026-11-19（基于21个有效收盘价）",
      ),
    },
  },
  {
    code: "DEMO.MISS",
    name: "数据缺失示例",
    industry: "演示",
    metrics: {
      revenue_yoy: revenue(null, "演示：最近报告期营收字段未返回，无法判定经营改善"),
      pe_ttm: m("pe_ttm", "PE(TTM)", 16.0, "倍", PE_ASOF),
      volatility_20d: m(
        "volatility_20d",
        "近20日波动率",
        null,
        "%",
        "近20个交易日波动率",
        {
          missingReason: "近20个交易日波动率需要 21 个有效收盘价，实际仅 5 个，无法计算",
        },
      ),
    },
  },
];

export const DEMO_META = {
  asOf: "2026-11-19",
  universeNote: "演示股票池（15 只），用于无扶摇 Key 时跑通主链路；结果已标注为演示数据。",
  dataMode: "demo" as const,
};
