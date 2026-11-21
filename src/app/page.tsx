"use client";

import { useEffect, useMemo, useState } from "react";
import { ConditionEditor } from "@/components/ConditionEditor";
import { ResultPanel } from "@/components/ResultPanel";
import { StrategyPanel } from "@/components/StrategyPanel";
import { detectConflicts } from "@/lib/conflicts";
import { classifyScreenOutcome } from "@/lib/screen-outcome";
import {
  deleteStrategy,
  listStrategies,
  saveStrategy,
  type SavedStrategy,
} from "@/lib/strategies";
import type {
  ClarifyResult,
  Condition,
  ScreenResult,
  StockStatus,
} from "@/lib/types";

const DEFAULT_INTENT = "经营改善、估值合理、走势稳定";

function conditionsSignature(conditions: Condition[]): string {
  return JSON.stringify(
    conditions.map((c) => ({
      id: c.id,
      enabled: c.enabled,
      op: c.op,
      value: c.value,
      valueMax: c.valueMax,
    })),
  );
}

export default function HomePage() {
  const [intent, setIntent] = useState(DEFAULT_INTENT);
  const [clarify, setClarify] = useState<ClarifyResult | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [result, setResult] = useState<ScreenResult | null>(null);
  const [previousSelected, setPreviousSelected] = useState<string[] | undefined>();
  const [previousConditions, setPreviousConditions] = useState<Condition[] | undefined>();
  const [snapshotId, setSnapshotId] = useState<string | undefined>();
  const [screenedSignature, setScreenedSignature] = useState<string | null>(null);
  const [filter, setFilter] = useState<StockStatus | "all">("all");
  const [busy, setBusy] = useState<"clarify" | "screen" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<SavedStrategy[]>([]);
  const [strategyName, setStrategyName] = useState("");

  const liveConflicts = useMemo(
    () => (conditions.length ? detectConflicts(conditions) : []),
    [conditions],
  );

  const conditionsDirty =
    !!result &&
    !!screenedSignature &&
    conditionsSignature(conditions) !== screenedSignature;

  useEffect(() => {
    setStrategies(listStrategies());
  }, []);

  async function handleClarify() {
    setBusy("clarify");
    setError(null);
    setNotice(null);
    setResult(null);
    setPreviousSelected(undefined);
    setPreviousConditions(undefined);
    setSnapshotId(undefined);
    setScreenedSignature(null);
    try {
      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
      });
      const data = (await res.json()) as ClarifyResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "澄清失败");
      setClarify(data);
      setConditions(data.conditions);
      if (data.complianceBlocked) {
        setNotice(data.complianceMessage ?? data.summary);
      } else if ((data.unsupportedAspects?.length ?? 0) > 0 && data.conditions.length === 0) {
        setNotice("当前意图涉及的指标均暂不支持，请改写后再澄清。");
      } else {
        setNotice(
          data.draftNotes?.length
            ? `已生成可修改条件。${data.draftNotes[0]}请检查阈值后点击「执行筛选」。`
            : "已生成可修改条件。请检查阈值后点击「执行筛选」。",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "澄清失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleScreen() {
    if (!conditions.length) {
      setError("请先生成条件草稿");
      return;
    }
    setBusy("screen");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conditions,
          previousSelectedCodes: previousSelected,
          previousConditions,
          snapshotId,
        }),
      });
      const data = (await res.json()) as ScreenResult & { error?: string; note?: string };
      if (!res.ok) throw new Error(data.error ?? data.note ?? "筛选失败");
      setResult(data);
      setSnapshotId(data.snapshotId);
      setPreviousSelected(
        data.results.filter((r) => r.status === "selected").map((r) => r.code),
      );
      setPreviousConditions(conditions.map((c) => ({ ...c })));
      setScreenedSignature(conditionsSignature(conditions));
      setFilter("all");
      const refreshed = data.dataAlerts?.some((a) => a.includes("已刷新数据，前后条件均按新快照重算"));
      const sameSnap = data.dataAlerts?.some((a) => a.includes("同一数据快照"));
      const outcome = classifyScreenOutcome(data.counts, data.dataAlerts);
      if (outcome.kind === "data_unavailable") {
        setNotice(`筛选完成，但数据侧异常：${outcome.tip}`);
      } else if (outcome.kind === "all_pending") {
        setNotice(`${outcome.tip}。原条件已保留。`);
      } else if (outcome.kind === "too_strict") {
        setNotice(`${outcome.tip}。原条件已保留，请修改后重试。`);
      } else if (data.delta) {
        setNotice(
          refreshed
            ? `筛选完成（已刷新数据并按新快照重算前后条件）。${data.delta.note}`
            : sameSnap
              ? `筛选完成（同一数据快照）。${data.delta.note}`
              : `筛选完成。${data.delta.note}`,
        );
      } else {
        setNotice(
          "筛选完成。若要查看进出名单，请修改下方阈值后再次点击「执行筛选」。",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "筛选失败");
    } finally {
      setBusy(null);
    }
  }

  function handleSaveStrategy() {
    if (!conditions.length) {
      setError("没有可保存的条件");
      return;
    }
    const saved = saveStrategy({
      name: strategyName,
      intent,
      conditions,
      dataMode: result?.dataMode,
      counts: result?.counts,
      selectedCodes: result?.results
        .filter((r) => r.status === "selected")
        .map((r) => r.code),
    });
    setStrategies(listStrategies());
    setStrategyName("");
    setNotice(`策略「${saved.name}」已保存到本机。`);
  }

  function handleLoadStrategy(s: SavedStrategy) {
    setIntent(s.intent);
    setConditions(s.conditions.map((c) => ({ ...c })));
    setClarify({
      intent: s.intent,
      summary: `已加载本地策略「${s.name}」。条件来自保存快照，可继续修改后筛选。`,
      questions: [],
      conditions: s.conditions,
      conflicts: detectConflicts(s.conditions),
      aiRoleNote: "加载的是本地保存条件；入选/排除仍由确定性引擎计算。",
      usedLlm: false,
    });
    setResult(null);
    setPreviousSelected(s.selectedCodes);
    setPreviousConditions(s.conditions.map((c) => ({ ...c })));
    setSnapshotId(undefined);
    setScreenedSignature(null);
    setNotice(`已加载「${s.name}」。点击「执行筛选」可基于当前条件重新计算。`);
  }

  function handleDeleteStrategy(id: string) {
    deleteStrategy(id);
    setStrategies(listStrategies());
    setNotice("已删除策略。");
  }

  return (
    <main className="page">
      <header style={{ marginBottom: "1.75rem" }}>
        <p className="eyebrow">题目 02 · 自然语言智能选股与策略解释器</p>
        <h1>把模糊意图变成可检查的选股条件</h1>
        <p className="lead">
          输入自然语言 → 澄清并生成条件草稿 → 修改阈值 → 执行筛选 →
          查看入选/排除依据。再次改条件并筛选，可看到名单进出；支持保存策略到本机。
        </p>
      </header>

      <section className="card">
        <label htmlFor="intent">自然语言选股意图</label>
        <textarea
          id="intent"
          style={{ marginTop: 8 }}
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder={DEFAULT_INTENT}
        />
        <div className="row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleClarify}
            disabled={busy !== null}
          >
            {busy === "clarify" ? "澄清中…" : "1. 澄清意图并生成条件草稿"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleScreen}
            disabled={busy !== null || conditions.length === 0}
          >
            {busy === "screen" ? "筛选中…" : "2. 执行筛选"}
          </button>
        </div>
        {error && (
          <p className="alert alert-error" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}
        {notice && !error && (
          <p className="alert alert-info" style={{ marginTop: 12 }}>
            {notice}
          </p>
        )}
        {conditionsDirty && (
          <p className="alert alert-warn" style={{ marginTop: 12 }}>
            条件已修改，但尚未重新筛选。请再点「2. 执行筛选」，页面会解释相对上一轮哪些股票新进/退出。
          </p>
        )}
      </section>

      {clarify && (
        <section className="card">
          <h2>澄清与职责边界</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            {clarify.summary}
          </p>
          <p style={{ marginTop: 8, fontSize: "0.9rem" }}>{clarify.aiRoleNote}</p>
          <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            条件起草：{clarify.usedLlm ? "已调用 LLM（usedLlm=true）" : "本地规则启发式（usedLlm=false）"}
          </p>
          {clarify.complianceBlocked && clarify.complianceMessage && (
            <p className="alert alert-error" style={{ marginTop: 12 }}>
              {clarify.complianceMessage}
            </p>
          )}
          {(clarify.unsupportedAspects?.length ?? 0) > 0 && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 600 }}>本次无法筛选以下暂不支持的指标：</div>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {clarify.unsupportedAspects!.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {clarify.conditions.length === 0 && (
                <p style={{ marginTop: 8, marginBottom: 0 }}>
                  请改写意图，改用营收同比、PE(TTM)、近20日波动率等已支持条件。
                </p>
              )}
            </div>
          )}
          {(clarify.draftNotes?.length ?? 0) > 0 && (
            <div className="alert alert-warn" style={{ marginTop: 12 }}>
              {clarify.draftNotes!.map((n) => (
                <p key={n} style={{ margin: "0 0 6px" }}>
                  {n}
                </p>
              ))}
            </div>
          )}
          {clarify.questions.length > 0 && (
            <div className="stack" style={{ marginTop: 14 }}>
              {clarify.questions.map((q) => (
                <div key={q.id} className="question">
                  <div style={{ fontWeight: 600 }}>{q.question}</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    可选：{q.options.join(" / ")}
                  </div>
                  <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                    对应指标：{q.relatedMetric}（请在下方条件卡直接改阈值）
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {conditions.length > 0 && (
        <ConditionEditor
          conditions={conditions}
          conflicts={liveConflicts}
          onChange={setConditions}
        />
      )}

      {conditions.length > 0 && (
        <StrategyPanel
          strategies={strategies}
          draftName={strategyName}
          onDraftName={setStrategyName}
          canSave={conditions.length > 0}
          onSave={handleSaveStrategy}
          onLoad={handleLoadStrategy}
          onDelete={handleDeleteStrategy}
        />
      )}

      <ResultPanel result={result} filter={filter} onFilter={setFilter} />

      <footer className="footer-note">
        <p>
          事实：表格中的实际值、来源、时点。推断：条件草稿与自然语言映射。不确定：数据缺失导致的「待确认」。
        </p>
        <p>本产品不提供买卖建议、收益承诺或确定性涨跌预测。</p>
      </footer>
    </main>
  );
}
