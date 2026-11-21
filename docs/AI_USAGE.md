# AI 使用与验证记录

## 使用的 AI 工具

- Cursor Agent：实现主链路、扶摇口径修正、快照复用、合规拒绝、文档与提交包。
- 可选运行时 LLM（`OPENAI_API_KEY`）：仅起草条件 JSON；未配置则 `usedLlm=false`。
- 扶摇 REST（非 Cursor MCP）：估值 / 财务指标 / 利润表披露日 / 历史 K 线。

## 扶摇路径与原始字段核对

### 路径修正

初版错误路径 `/api/v1/market/snapshots` → 按官方改为：

| 用途 | REST |
|------|------|
| PE(TTM) | `GET /api/a-share/valuations/snapshot` → `data.item[].pe_ttm`，时点 `data.timestamp` |
| 营收同比 | `GET /api/a-share/financials/indicators` → `calculate_operating_income_yoy_growth_ratio`（文档名 `operating_income_yoy_growth_ratio` 亦兼容） |
| 公告日 | `GET /api/a-share/financials/income-statements` → `report_date_ms` |
| 波动率 | `GET /api/a-share/prices/historical` → 最近 **21** 个有效 `close_price` 计算近 20 日年化波动；不足则缺失并说明 |

鉴权：`X-api-key`。

### 口径修正（本轮）

1. 营收同比 `asOf` 展示真实报告期（如 `报告期 2025年报（2025-4）`），有 `report_date_ms` 则追加公告日。
2. 波动率不足 21 根收盘价时不计算、不静默通过。
3. 修改阈值做进出对比时，客户端携带 `snapshotId`，服务端复用同一 `MarketBundle`，保证前后轮数据一致。

### 茅台核对样例

- `pe_ttm` ≈ 22.605792；来源扶摇 REST。
- 营收同比实盘字段带 `calculate_` 前缀；报告期由 `FUYAO_REPORT` 控制。

## 合规实测

输入「给我一只明天必涨的股票」→ 澄清接口合规拦截，不预测涨跌、不荐股；`usedLlm=false`。

## 线上 usedLlm

当前 Production 仅配置扶摇 Key 时实测 **`usedLlm=false`**。若需 true，在 Vercel Environment Variables 增加 `OPENAI_API_KEY` 后 Redeploy。

## 其他修正

- 默认营收阈值 `>0`，便于真实样本验收进出名单。
- Next.js 升级 `15.5.7` 以通过 Vercel 安全拦截（CVE-2025-66478）。
- 职责边界：LLM/规则只起草条件；入选/排除由确定性引擎计算。
