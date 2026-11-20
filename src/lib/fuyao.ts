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
  pe_mrq?: number | null;
  pb_mrq?: number | null;
  ps_ttm?: number | null;
  pcf_ttm?: number | null;
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

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function msToDate(ms?: number | null): string {
  if (!ms || !Number.isFinite(ms)) return new Date().toISOString().slice(0, 10);
  return new Date(ms).toISOString().slice(0, 10);
}

function metric(
  field: MetricId,
  label: string,
  value: number | null,
  unit: string,
  asOf: string,
  missingReason?: string,
): MetricValue {
  return {
    field,
    label,
    value,
    unit,
    asOf,
    source: "扶摇 REST API",
    missingReason,
  };
}

/**
 * Fuyao client aligned with official docs:
 * https://fuyao.aicubes.cn/docs/
 *
 * Auth: header `X-api-key` (same key as MCP env `API_KEY`).
 * PE(TTM): GET /api/a-share/valuations/snapshot → data.item[].pe_ttm
 * Revenue YoY: GET /api/a-share/financials/indicators → operating_income_yoy_growth_ratio
 * Volatility: derived from GET /api/a-share/prices/historical close_price series
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
        "扶摇 MCP 未接入本会话；网页通过 REST 调用同一套能力。拿到 Key 后填入 .env.local 即可。",
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
      stocks
        .map((s) => s.metrics.pe_ttm.asOf)
        .find((d) => !!d) ?? new Date().toISOString().slice(0, 10);
    return {
      dataMode: "fuyao",
      asOf,
      universeNote:
        "扶摇真实数据（REST：valuations/snapshot + financials/indicators + prices/historical）",
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
  const asOf = msToDate(valuations.data.timestamp);
  const items = valuations.data.item ?? [];
  notes.push(
    `扶摇估值快照成功：${items.length} 只，data.timestamp=${valuations.data.timestamp ?? "null"}（${asOf}）。`,
  );

  const report = env("FUYAO_REPORT") ?? guessRecentReport();
  const end = Date.now();
  const start = end - 45 * 24 * 3600 * 1000;

  const stocks: StockSnapshot[] = [];
  for (const code of codes) {
    const val = items.find((i) => i.thscode?.toUpperCase() === code);
    const pe = typeof val?.pe_ttm === "number" ? val.pe_ttm : null;

    let revenue: number | null = null;
    let revenueMissing = `扶摇财务指标未取到营收同比（report=${report}）`;
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
        // Docs list operating_income_yoy_growth_ratio; live payload uses calculate_* prefix.
        const hit = growth?.indicators?.find(
          (i) =>
            i.index_id === "operating_income_yoy_growth_ratio" ||
            i.index_id === "calculate_operating_income_yoy_growth_ratio",
        );
        if (hit?.value != null && hit.value !== "") {
          revenue = Number(hit.value);
          if (!Number.isFinite(revenue)) revenue = null;
          else revenueMissing = undefined as unknown as string;
        }
      } else {
        revenueMissing = `财务指标 code=${fin.code} ${fin.message}`;
      }
    } catch (err) {
      revenueMissing = err instanceof Error ? err.message : String(err);
    }

    let vol: number | null = null;
    let volMissing = "近20日波动率需由历史K线计算，本次未取到足够收盘价";
    let volAsOf = asOf;
    try {
      const hist = await getJson<{ timestamp?: number | null; item?: PriceBar[] }>(
        baseUrl,
        apiKey,
        `/api/a-share/prices/historical?thscode=${encodeURIComponent(code)}&interval=1d&start=${start}&end=${end}&adjust=forward`,
      );
      if (hist.code === 0) {
        const closes = (hist.data.item ?? [])
          .map((b) => b.close_price)
          .filter((n) => typeof n === "number" && Number.isFinite(n));
        vol = annualizedVolFromCloses(closes.slice(-21));
        if (vol !== null) {
          volMissing = undefined as unknown as string;
          const last = hist.data.item?.[hist.data.item.length - 1];
          volAsOf = msToDate(last?.date_ms ?? hist.data.timestamp);
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
          asOf,
          revenue === null ? revenueMissing : undefined,
        ),
        pe_ttm: metric(
          "pe_ttm",
          "PE(TTM)",
          pe,
          "倍",
          asOf,
          pe === null ? "扶摇估值快照缺少 pe_ttm" : undefined,
        ),
        volatility_20d: metric(
          "volatility_20d",
          "近20日波动率",
          vol,
          "%",
          volAsOf,
          vol === null ? volMissing : undefined,
        ),
      },
    });
  }

  return stocks;
}

function annualizedVolFromCloses(closes: number[]): number | null {
  if (closes.length < 3) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (rets.length < 2) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance =
    rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (rets.length - 1);
  const daily = Math.sqrt(variance);
  return Math.round(daily * Math.sqrt(252) * 10000) / 100; // percent, 2 decimals
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
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    headers: {
      "X-api-key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  // Official docs: business errors often still HTTP 200 with code in body
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
