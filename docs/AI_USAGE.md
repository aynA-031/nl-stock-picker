# AI 使用与验证记录

## 使用的 AI 工具

- Cursor Agent：实现主链路、扶摇口径修正、快照复用、合规拒绝、入参校验、不支持指标提示、文档与提交包。
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

### 口径修正

1. 营收同比 `asOf` 展示真实报告期（如 `报告期 2025年报（2025-4）`），有 `report_date_ms` 则追加公告日。
2. 波动率不足 21 根收盘价时不计算、不静默通过。
3. 修改阈值做进出对比时，客户端携带 `snapshotId`；可复用则同快照对比；不可复用则同一新数据上分别跑旧/新条件，并提示「已刷新数据，前后条件均按新快照重算」。

### 茅台核对样例

- `pe_ttm` ≈ 22.605792；来源扶摇 REST。
- 营收同比实盘字段带 `calculate_` 前缀；报告期由 `FUYAO_REPORT` 控制。

## 本轮评审修复（发现 → 修复）

### 1. `/api/screen` 缺少运行时入参校验

- **发现**：TypeScript 类型在编译期有效，但 HTTP JSON 可传入 `value: "abc"`、倒置 `between` 区间、错误 `field` 等；引擎可能把脏数据当正常筛选。
- **修复**：新增 `src/lib/validate-conditions.ts`，`conditions` 与 `previousConditions` 共用校验（ID 白名单、`field`≡`id`、`op` 枚举、有限数字；`between` 要求有限 `valueMax` 且下限≤上限）。失败返回 **HTTP 400** 并指出具体条件/字段。

### 2. LLM 草稿阈值与 0 命中体验不足（含补齐）

- **发现**：模型可能输出非数字/倒置区间/无意义负波动率；仅按 `selected===0` 提示「过严」会把「全部待确认（缺数）」误判成阈值问题。
- **修复**：
  1. `LLM_THRESHOLD_RANGES` 对各指标做明确数值范围校验（波动率上限须 ∈ [0.1, 200]%）；`applyLlmDraftPatches` 无效则回退 `defaults.ts` 并写 `draftNotes` 原因。模拟「波动率 -1%」已验证回退默认 35%。
  2. 前后端共用 `classifyScreenOutcome`：仅数据可用且存在 excluded、无入选时提示「阈值可能过严」；8 只全部待确认时提示数据缺失/待确认，不提示过严；接口失败走 `data_unavailable`。

### 3. 不支持指标未明示

- **发现**：用户提到 ROE、负债率、分红等时仍可能生成默认三条件，易误解为已筛选这些指标。
- **修复**：`ClarifyResult.unsupportedAspects` + `src/lib/unsupported.ts`；澄清卡红字列出；混合意图只生成已支持条件；全部不支持则 `conditions=[]` 并提示改写意图。

## 合规实测

输入「给我一只明天必涨的股票」→ 澄清接口合规拦截，不预测涨跌、不荐股；`usedLlm=false`。

## 线上 usedLlm（实测）

- 正常澄清：Production 已配置模型 Key → **`usedLlm=true`**。
- 「给我一只明天必涨的股票」：合规拦截 → **`usedLlm=false`**，不输出必涨标的。

## 其他修正

- 默认营收阈值 `>0`，便于真实样本验收进出名单。
- Next.js 升级 `15.5.7` 以通过 Vercel 安全拦截（CVE-2025-66478）。
- 职责边界：LLM/规则只起草条件；入选/排除由确定性引擎计算。
