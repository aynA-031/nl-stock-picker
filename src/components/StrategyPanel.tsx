"use client";

import type { SavedStrategy } from "@/lib/strategies";

interface Props {
  strategies: SavedStrategy[];
  draftName: string;
  onDraftName: (v: string) => void;
  canSave: boolean;
  onSave: () => void;
  onLoad: (s: SavedStrategy) => void;
  onDelete: (id: string) => void;
}

export function StrategyPanel({
  strategies,
  draftName,
  onDraftName,
  canSave,
  onSave,
  onLoad,
  onDelete,
}: Props) {
  return (
    <section className="card">
      <h2>保存策略</h2>
      <p className="muted" style={{ marginTop: 8 }}>
        将当前意图与条件保存到本机浏览器（localStorage），便于下次加载继续比较；不含买卖建议。
      </p>
      <div className="row" style={{ marginTop: 12 }}>
        <input
          type="text"
          placeholder="策略名称，例如：稳健估值-v1"
          value={draftName}
          onChange={(e) => onDraftName(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={!canSave}>
          保存当前策略
        </button>
      </div>

      {strategies.length === 0 ? (
        <p className="muted" style={{ marginTop: 12 }}>
          暂无已保存策略。完成一次条件编辑后即可保存。
        </p>
      ) : (
        <div className="stack" style={{ marginTop: 14 }}>
          {strategies.map((s) => (
            <div
              key={s.id}
              className="question"
              style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                  {new Date(s.savedAt).toLocaleString("zh-CN")} · 意图：{s.intent}
                  {s.counts
                    ? ` · 上次入选 ${s.counts.selected} / 排除 ${s.counts.excluded} / 待确认 ${s.counts.pending}`
                    : ""}
                  {s.dataMode ? ` · ${s.dataMode === "fuyao" ? "扶摇" : "演示"}` : ""}
                </div>
              </div>
              <div className="row">
                <button type="button" className="btn btn-secondary" onClick={() => onLoad(s)}>
                  加载
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => onDelete(s.id)}
                  style={{ borderColor: "#e7b4ab", color: "var(--danger)" }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
