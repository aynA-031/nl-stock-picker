import { DEMO_META, DEMO_STOCKS } from "./demo-data";
import type { DataMode, MetricId, MetricValue, StockSnapshot } from "./types";

export interface MarketBundle {
  dataMode: DataMode;
  asOf: string;
  universeNote: string;
  stocks: StockSnapshot[];
  fetchNotes: string[];
}

interface ApiEnvelope<T> {
  code: number;
  message: string;
  request_id?: string;
  data: T;
}

interface ValuationItem {
  thscode: string;
  ticker?: string;
  name?: string | null;
  pe_ttm?: number | null;
}

interface ValuationData {
  timestamp?: number | null;
  total?: number;
  item?: ValuationItem[];
}

interface PriceBar {
  date_ms: number;
  close_price: number;
}

interface IncomeItem {
  fiscal_year?: number;
  fiscal_period?: string;
  report_date_ms?: number | null;
  period_end_ms?: number | null;
}

const VOL_CLOSE_COUNT = 21; // 20 returns need 21 closes

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function msToDate(ms?: number | null): string | null {
  if (!ms || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

export function formatReportLabel(report: string): string {
  const m = report.match(/^(\d{4})-([1-4])$/);
  if (!m) return `报告期 ${report}`;
  const map: Record<string, string> = {
    "1": "一季报",
    "2": "中报",
    "3": "三季报",
    "4": "年报",
  };
  return `报告期 ${m[1]}${map[m[2]]}（${report}）`;
}

function metric(
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
    source: "扶摇 REST API",
    missingReason: extra?.missingReason,
    reportPeriod: extra?.reportPeriod,
    announceDate: extra?.announceDate,
  };
}

/**
 * Fuyao client — official REST paths only.
 * PE: valuations/snapshot pe_ttm
 * Revenue YoY: financials/indicators (+ income-statements report_date_ms)
 * Volatility: prices/historical — requires 21 valid closes for 20-day vol
 */
export async function loadMarketBundle(): Promise<MarketBundle> {
  const apiKey = env("FUYAO_API_KEY") ?? env("API_KEY");
  const baseUrl = (env("FUYAO_BASE_URL") ?? "https://fuyao.aicubes.cn").replace(/\/$/, "");

  if (!apiKey) {
    return {
      ...DEMO_META,
      stocks: DEMO_STOCKS,
      fetchNotes: [
        "未配置 FUYAO_API_KEY（或 API_KEY），已使用明确标注的演示数据。",
        "扶摇 MCP 未接入本会话；网页通过 REST 调用同一套能力。拿到 Key 后填入 .env.local / Vercel 环境变量即可。",
      ],
    };
  }

  const notes: string[] = [];
  try {
    const stocks = await fetchOfficialBundle(baseUrl, apiKey, notes);
    if (stocks.length === 0) {
      notes.push("扶摇返回空列表，回退到演示数据，避免静默空成功。");
      return { ...DEMO_META, stocks: DEMO_STOCKS, fetchNotes: notes };
    }
    const asOf =
      stocks.map((s) => s.metrics.pe_ttm.asOf).find((d) => !!d) ??
      new Date().toISOString().slice(0, 10);
    return {
      dataMode: "fuyao",
      asOf,
      universeNote:
        "扶摇真实数据（REST：valuations/snapshot + financials/indicators + prices/historical；名单对比复用同一快照）",
      stocks,
      fetchNotes: notes,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    notes.push(`扶摇调用失败：${message}。已回退演示数据并保留失败原因。`);
    return { ...DEMO_META, stocks: DEMO_STOCKS, fetchNotes: notes };
  }
}

async function fetchOfficialBundle(
  baseUrl: string,
  apiKey: string,
  notes: string[],
): Promise<StockSnapshot[]> {
  const codes = (
    env("FUYAO_UNIVERSE") ??
    "600519.SH,000858.SZ,601318.SH,600036.SH,300750.SZ,002594.SZ,601012.SH,600276.SH"
  )
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  const valuations = await getJson<ValuationData>(
    baseUrl,
    apiKey,
    `/api/a-share/valuations/snapshot?thscodes=${encodeURIComponent(codes.join(","))}`,
  );
  assertOk(valuations, "valuations/snapshot");
  const peAsOf = msToDate(valuations.data.timestamp) ?? new Date().toISOString().slice(0, 10);
  const items = valuations.data.item ?? [];
  notes.push(
    `扶摇估值快照成功：${items.length} 只，data.timestamp=${valuations.data.timestamp ?? "null"}（${peAsOf}）。`,
  );

  const report = env("FUYAO_REPORT") ?? guessRecentReport();
  // Wider window so we can collect 21 trading closes
  const end = Date.now();
  const start = end - 90 * 24 * 3600 * 1000;

  const stocks: StockSnapshot[] = [];
  for (const code of codes) {
    const val = items.find((i) => i.thscode?.toUpperCase() === code);
    const pe = typeof val?.pe_ttm === "number" ? val.pe_ttm : null;

    let revenue: number | null = null;
    let revenueMissing = `扶摇财务指标未取到营收同比（report=${report}）`;
    let announceDate: string | undefined;
    const reportLabel = formatReportLabel(report);
    try {
      const fin = await getJson<{
        thscode: string;
        report: string;
        abilities?: Array<{
          ability: string;
          indicators?: Array<{ index_id: string; value: string | null }>;
        }>;
      }>(
        baseUrl,
        apiKey,
        `/api/a-share/financials/indicators?thscode=${encodeURIComponent(code)}&report=${encodeURIComponent(report)}`,
      );
      if (fin.code === 0) {
        const growth = fin.data.abilities?.find((a) => a.ability === "growth");
        const hit = growth?.indicators?.find(
          (i) =>
            i.index_id === "operating_income_yoy_growth_ratio" ||
            i.index_id === "calculate_operating_income_yoy_growth_ratio",
        );
        if (hit?.value != null && hit.value !== "") {
          revenue = Number(hit.value);
          if (!Number.isFinite(revenue)) {
            revenue = null;
          } else {
            revenueMissing = undefined as unknown as string;
          }
        }
        announceDate = (await fetchAnnounceDate(baseUrl, apiKey, code, report)) ?? undefined;
      } else {
        revenueMissing = `财务指标 code=${fin.code} ${fin.message}`;
      }
    } catch (err) {
      revenueMissing = err instanceof Error ? err.message : String(err);
    }

    const revenueAsOf = announceDate
      ? `${reportLabel}；公告日 ${announceDate}`
      : reportLabel;

    let vol: number | null = null;
    let volMissing = `近20个交易日波动率需要 ${VOL_CLOSE_COUNT} 个有效收盘价，当前不足`;
    let volAsOf = peAsOf;
    try {
      const hist = await getJson<{ timestamp?: number | null; item?: PriceBar[] }>(
        baseUrl,
        apiKey,
        `/api/a-share/prices/historical?thscode=${encodeURIComponent(code)}&interval=1d&start=${start}&end=${end}&adjust=forward`,
      );
      if (hist.code === 0) {
        const bars = (hist.data.item ?? []).filter(
          (b) => typeof b.close_price === "number" && Number.isFinite(b.close_price) && b.close_price > 0,
        );
        const lastBars = bars.slice(-VOL_CLOSE_COUNT);
        if (lastBars.length < VOL_CLOSE_COUNT) {
          vol = null;
          volMissing = `近20个交易日波动率需要 ${VOL_CLOSE_COUNT} 个有效收盘价，实际仅 ${lastBars.length} 个，无法计算`;
        } else {
          const closes = lastBars.map((b) => b.close_price);
          vol = annualizedVolFromCloses(closes);
          if (vol === null) {
            volMissing = `已取到 ${closes.length} 个收盘价，但收益序列无效，无法计算波动率`;
          } else {
            volMissing = undefined as unknown as string;
            volAsOf = `近${VOL_CLOSE_COUNT - 1}个交易日波动率；K线截止 ${msToDate(lastBars[lastBars.length - 1]?.date_ms) ?? peAsOf}`;
          }
        }
      } else {
        volMissing = `历史K线 code=${hist.code} ${hist.message}`;
      }
    } catch (err) {
      volMissing = err instanceof Error ? err.message : String(err);
    }

    stocks.push({
      code,
      name: val?.name ?? code,
      industry: "A股",
      metrics: {
        revenue_yoy: metric(
          "revenue_yoy",
          "营收同比",
          revenue,
          "%",
          revenueAsOf,
          {
            missingReason: revenue === null ? revenueMissing : undefined,
            reportPeriod: report,
            announceDate,
          },
        ),
        pe_ttm: metric(
          "pe_ttm",
          "PE(TTM)",
          pe,
          "倍",
          `估值快照时点 ${peAsOf}`,
          { missingReason: pe === null ? "扶摇估值快照缺少 pe_ttm" : undefined },
        ),
        volatility_20d: metric(
          "volatility_20d",
          "近20日波动率",
          vol,
          "%",
          volAsOf,
          { missingReason: vol === null ? volMissing : undefined },
        ),
      },
    });
  }

  return stocks;
}

async function fetchAnnounceDate(
  baseUrl: string,
  apiKey: string,
  code: string,
  report: string,
): Promise<string | null> {
  const m = report.match(/^(\d{4})-([1-4])$/);
  if (!m) return null;
  const year = Number(m[1]);
  const q = m[2];
  const period = q === "4" ? "annual" : "quarterly";
  try {
    const res = await getJson<{ item?: IncomeItem[] }>(
      baseUrl,
      apiKey,
      `/api/a-share/financials/income-statements?thscode=${encodeURIComponent(code)}&period=${period}&limit=8`,
    );
    if (res.code !== 0) return null;
    const items = res.data.item ?? [];
    const hit = items.find((it) => {
      if (it.fiscal_year !== year) return false;
      if (period === "annual") return true;
      const fp = (it.fiscal_period ?? "").toUpperCase();
      if (q === "1") return fp.includes("Q1") || fp === "1";
      if (q === "2") return fp.includes("Q2") || fp.includes("H1") || fp === "2";
      if (q === "3") return fp.includes("Q3") || fp === "3";
      return false;
    });
    return msToDate(hit?.report_date_ms ?? null);
  } catch {
    return null;
  }
}

/** Requires exactly 21 closes → 20 log returns. */
function annualizedVolFromCloses(closes: number[]): number | null {
  if (closes.length < VOL_CLOSE_COUNT) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (rets.length < VOL_CLOSE_COUNT - 1) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance =
    rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (rets.length - 1);
  const daily = Math.sqrt(variance);
  return Math.round(daily * Math.sqrt(252) * 10000) / 100;
}

function guessRecentReport(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  if (m <= 4) return `${y - 1}-4`;
  if (m <= 7) return `${y}-1`;
  if (m <= 10) return `${y}-2`;
  return `${y}-3`;
}

async function getJson<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      "X-api-key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const payload = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok && (payload?.code === undefined || payload.code === 0)) {
    throw new Error(`HTTP ${res.status} ${res.statusText} @ ${path}`);
  }
  return payload;
}

function assertOk<T>(envelope: ApiEnvelope<T>, label: string): void {
  if (envelope.code !== 0) {
    throw new Error(`${label} code=${envelope.code} ${envelope.message}`);
  }
}
