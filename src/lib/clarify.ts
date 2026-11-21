import { detectConflicts } from "./conflicts";
import { DEFAULT_CONDITIONS } from "./defaults";
import type { ClarificationQuestion, ClarifyResult, Condition } from "./types";

function cloneConditions(): Condition[] {
  return DEFAULT_CONDITIONS.map((c) => ({ ...c }));
}

function baseQuestions(): ClarificationQuestion[] {
  return [
    {
      id: "q_revenue",
      question: "「经营改善」更看重哪一档营收同比增速？",
      options: ["> 0%（默认）", "> 10%", "> 20%"],
      relatedMetric: "revenue_yoy",
    },
    {
      id: "q_pe",
      question: "「估值合理」的 PE(TTM) 可接受区间？",
      options: ["8–25 倍", "8–35 倍（默认）", "10–40 倍"],
      relatedMetric: "pe_ttm",
    },
    {
      id: "q_vol",
      question: "「走势稳定」对近 20 日年化波动率的上限？",
      options: ["< 25%", "< 35%（默认）", "< 45%"],
      relatedMetric: "volatility_20d",
    },
  ];
}

function isPredictionOrAdviceIntent(intent: string): boolean {
  return /必涨|稳赚|保证收益|明天涨|后天涨|荐股买入|买哪只|给我一只.*涨|涨停推荐|必赚/.test(
    intent,
  );
}

function applyHeuristicAdjustments(intent: string, conditions: Condition[]): Condition[] {
  const next = conditions.map((c) => ({ ...c }));

  if (/高增长|高速增长|强改善/.test(intent)) {
    const c = next.find((x) => x.id === "revenue_yoy");
    if (c) c.value = 20;
  }
  if (/低估|便宜|便宜估值/.test(intent)) {
    const c = next.find((x) => x.id === "pe_ttm");
    if (c) {
      c.value = 5;
      c.valueMax = 20;
    }
  }
  if (/更稳|波动更低|极度稳定/.test(intent)) {
    const c = next.find((x) => x.id === "volatility_20d");
    if (c) c.value = 25;
  }
  if (/激进|高波动可接受/.test(intent)) {
    const c = next.find((x) => x.id === "volatility_20d");
    if (c) c.value = 50;
  }

  return next;
}

async function tryLlmDraft(intent: string): Promise<Condition[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const system = `你是选股条件起草助手。只输出 JSON，不要投资建议，不要预测涨跌。
从用户意图生成三个条件的阈值调整：
- revenue_yoy: op ">" 或 ">=", value 数字(%)
- pe_ttm: op "between", value 下限, valueMax 上限
- volatility_20d: op "<" 或 "<=", value 年化波动率上限(%)
JSON 形如：{"revenue_yoy":{"op":">","value":10},"pe_ttm":{"op":"between","value":8,"valueMax":35},"volatility_20d":{"op":"<","value":35}}`;

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: intent },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as Record<
      string,
      { op?: Condition["op"]; value?: number; valueMax?: number }
    >;
    const conditions = cloneConditions();
    for (const c of conditions) {
      const patch = parsed[c.id];
      if (!patch) continue;
      if (patch.op) c.op = patch.op;
      if (typeof patch.value === "number") c.value = patch.value;
      if (typeof patch.valueMax === "number") c.valueMax = patch.valueMax;
    }
    return conditions;
  } catch {
    return null;
  }
}

/** AI / rules draft conditions; conflict detection stays deterministic. */
export async function clarifyIntent(intent: string): Promise<ClarifyResult> {
  const trimmed = intent.trim() || "经营改善、估值合理、走势稳定";

  if (isPredictionOrAdviceIntent(trimmed)) {
    const conditions = cloneConditions();
    return {
      intent: trimmed,
      summary:
        "已拒绝涨跌预测与买卖建议请求。本产品只提供可检查的数据条件筛选与解释，不输出“必涨”标的或交易指令。",
      questions: [],
      conditions,
      conflicts: detectConflicts(conditions),
      aiRoleNote:
        "合规边界：不预测涨跌、不承诺收益、不直接荐股。若你改用经营/估值/波动等事实意图，可继续生成条件并筛选。",
      usedLlm: false,
      complianceBlocked: true,
      complianceMessage:
        "无法提供“明天必涨”的股票或任何确定性涨跌预测。你可以改用如「经营改善、估值合理、走势稳定」等可验证条件进行筛选；结果仅为数据对照，不构成投资建议。",
    };
  }

  let usedLlm = false;
  let conditions = await tryLlmDraft(trimmed);
  if (conditions) {
    usedLlm = true;
  } else {
    conditions = applyHeuristicAdjustments(trimmed, cloneConditions());
  }

  const conflicts = detectConflicts(conditions);

  return {
    intent: trimmed,
    summary:
      "已将模糊意图映射为可检查的三个数据条件（营收同比、PE(TTM)、近20日波动率）。条件由 AI/规则起草，是否满足由确定性引擎计算。",
    questions: baseQuestions(),
    conditions,
    conflicts,
    aiRoleNote:
      "AI 只负责澄清与条件草稿；冲突识别与入选/排除判定由本地代码引擎执行，不由模型直接荐股。",
    usedLlm,
  };
}
