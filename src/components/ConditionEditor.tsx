"use client";

import type { Condition, ConflictIssue } from "@/lib/types";

interface Props {
  conditions: Condition[];
  conflicts: ConflictIssue[];
  onChange: (next: Condition[]) => void;
}

export function ConditionEditor({ conditions, conflicts, onChange }: Props) {
  function update(id: string, patch: Partial<Condition>) {
    onChange(conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  return (
    <section className="card">
      <h2>结构化条件（可修改）</h2>
      <p className="muted" style={{ marginTop: 8 }}>
        由 AI/规则起草，冲突检测与是否满足均由本地确定性引擎判断。
      </p>

      {conflicts.length > 0 && (
        <div className="stack" style={{ marginTop: 12 }}>
          {conflicts.map((c) => (
            <div key={c.id} className={`alert ${c.severity === "error" ? "alert-error" : "alert-warn"}`}>
              <strong>{c.severity === "error" ? "冲突错误" : "冲突提示"}：</strong>
              {c.message}
            </div>
          ))}
        </div>
      )}

      <div className="stack" style={{ marginTop: 12 }}>
        {conditions.map((c) => (
          <div key={c.id} className="condition-item">
            <label>
              <input
                type="checkbox"
                checked={c.enabled}
                onChange={(e) => update(c.id, { enabled: e.target.checked })}
              />{" "}
              启用
            </label>

            <div>
              <div style={{ fontWeight: 600 }}>{c.label}</div>
              <div className="muted" style={{ marginTop: 4 }}>
                {c.description}
              </div>
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                来源提示：{c.sourceHint}
              </div>
            </div>

            <div className="inline-fields">
              <select
                value={c.op}
                onChange={(e) =>
                  update(c.id, {
                    op: e.target.value as Condition["op"],
                    valueMax:
                      e.target.value === "between" ? (c.valueMax ?? c.value + 10) : undefined,
                  })
                }
              >
                <option value=">">&gt;</option>
                <option value=">=">&gt;=</option>
                <option value="<">&lt;</option>
                <option value="<=">&lt;=</option>
                <option value="between">区间</option>
              </select>
              <input
                type="number"
                value={c.value}
                onChange={(e) => update(c.id, { value: Number(e.target.value) })}
              />
              {c.op === "between" && (
                <>
                  <span className="muted">~</span>
                  <input
                    type="number"
                    value={c.valueMax ?? ""}
                    onChange={(e) => update(c.id, { valueMax: Number(e.target.value) })}
                  />
                </>
              )}
              <span className="muted">{c.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
