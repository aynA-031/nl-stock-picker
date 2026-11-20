"use client";

import type { ScreenResult, StockStatus } from "@/lib/types";

const statusMeta: Record<StockStatus, { label: string; className: string }> = {
  selected: { label: "入选", className: "badge-selected" },
  excluded: { label: "排除", className: "badge-excluded" },
  pending: { label: "待确认", className: "badge-pending" },
};

interface Props {
  result: ScreenResult | null;
  filter: StockStatus | "all";
  onFilter: (f: StockStatus | "all") => void;
}

export function ResultPanel({ result, filter, onFilter }: Props) {
  if (!result) {
    return <section className="card empty">修改条件后点击「执行筛选」，将在此展示入选 / 排除 / 待确认及依据。</section>;
  }

  const rows =
    filter === "all" ? result.results : result.results.filter((r) => r.status === filter);

  return (
    <section>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>筛选结果</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              数据模式：
              <strong style={{ color: "var(--ink)", marginLeft: 4 }}>
                {result.dataMode === "demo" ? "演示数据" : "扶摇真实数据"}
              </strong>
              <span style={{ margin: "0 8px" }}>·</span>
              时点 {result.asOf}
            </p>
          </div>
          <div className="row">
            <span className="chip">入选 {result.counts.selected}</span>
            <span className="chip">排除 {result.counts.excluded}</span>
            <span className="chip">待确认 {result.counts.pending}</span>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 12 }}>
          {result.universeNote}
        </p>
        {result.dataAlerts?.length > 0 && (
          <div className="stack" style={{ marginTop: 10 }}>
            {result.dataAlerts.map((note) => {
              const isFailure = /失败|错误|无法|未配置|回退|空列表|HTTP/i.test(note);
              return (
                <div
                  key={note}
                  className={`alert ${isFailure ? "alert-error" : "alert-warn"}`}
                  role="status"
                >
                  <strong>{isFailure ? "数据接口提示：" : "数据说明："}</strong>
                  {note}
                </div>
              );
            })}
          </div>
        )}
        <p className="alert" style={{ marginTop: 10, background: "#f7f2e8", color: "var(--muted)" }}>
          {result.disclaimer}
        </p>

        {result.delta && (
          <div className="alert alert-info" style={{ marginTop: 12 }} id="condition-delta">
            <div style={{ fontWeight: 600, color: "var(--accent)" }}>条件变化影响（相对上一轮入选名单）</div>
            <p style={{ margin: "6px 0 0" }}>{result.delta.note}</p>
            {result.delta.entered.length > 0 && (
              <p style={{ margin: "6px 0 0" }}>
                新进名单：
                {result.delta.entered.map((s) => `${s.name}(${s.code})`).join("、")}
              </p>
            )}
            {result.delta.exited.length > 0 && (
              <p style={{ margin: "6px 0 0" }}>
                退出名单：
                {result.delta.exited.map((s) => `${s.name}(${s.code})`).join("、")}
              </p>
            )}
            {result.delta.stillSelected.length > 0 && (
              <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
                仍保留：
                {result.delta.stillSelected.map((s) => `${s.name}(${s.code})`).join("、")}
              </p>
            )}
          </div>
        )}

        <div className="row" style={{ marginTop: 14 }}>
          {(["all", "selected", "excluded", "pending"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`chip ${filter === f ? "active" : ""}`}
              onClick={() => onFilter(f)}
            >
              {f === "all" ? "全部" : statusMeta[f].label}
            </button>
          ))}
        </div>
      </div>

      <div className="stack">
        {rows.map((row) => {
          const st = statusMeta[row.status];
          return (
            <article key={row.code} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1rem" }}>
                    {row.name}{" "}
                    <span className="muted" style={{ fontWeight: 400 }}>
                      {row.code}
                    </span>
                  </h3>
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    {row.industry}
                  </p>
                </div>
                <span className={`badge ${st.className}`}>{st.label}</span>
              </div>
              <p style={{ marginTop: 10, fontSize: "0.9rem" }}>{row.summary}</p>
              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table>
                  <thead>
                    <tr>
                      <th>条件</th>
                      <th>实际值</th>
                      <th>阈值</th>
                      <th>来源</th>
                      <th>时点</th>
                      <th>判定</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.checks.map((c) => (
                      <tr key={c.conditionId}>
                        <td>{c.label}</td>
                        <td>{c.actual === null ? "—" : `${c.actual}${c.unit}`}</td>
                        <td>{c.thresholdText}</td>
                        <td>{c.source}</td>
                        <td>{c.asOf}</td>
                        <td>
                          {c.passed === true && <span style={{ color: "var(--ok)" }}>通过</span>}
                          {c.passed === false && (
                            <span style={{ color: "var(--danger)" }}>未通过</span>
                          )}
                          {c.passed === null && (
                            <span style={{ color: "var(--pending)" }}>缺失</span>
                          )}
                          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                            {c.reason}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
