# AI 使用与验证记录

## 使用的 AI 工具

- Cursor Agent（Composer）：项目脚手架、主链路、扶摇接入修正、Vercel/GitHub 部署协助、文档。
- 可选运行时 LLM（`OPENAI_API_KEY`）：仅起草条件 JSON；**未配置时 `usedLlm=false`，走本地规则启发式**。
- 扶摇：线上/本地通过 **REST**（非 Cursor MCP）取数；MCP 与 REST 共用同一把 Key。

## AI 参与的环节

1. 生成 Next.js + TypeScript 选股主链路（澄清 → 条件卡 → 筛选 → 解释 → 进出名单 → 保存策略）。
2. 设计条件 schema、确定性引擎与冲突规则。
3. 初版扶摇客户端与演示数据回退。
4. 对照官方文档修正接口路径与字段映射（见下）。
5. 协助构建、推送 GitHub、升级 Next.js 安全版本、Vercel 环境变量指引。

## 扶摇接口路径与原始字段核对（候选人修正）

### 问题

初版客户端使用了臆测路径 `/api/v1/market/snapshots`，与官方文档不符；即便配置 Key 也无法拿到真实估值。

### 按官方文档修正后的路径

| 指标 | REST | 原始字段 / 口径 |
|------|------|-----------------|
| PE(TTM) | `GET /api/a-share/valuations/snapshot?thscodes=...` | `data.item[].pe_ttm`；时点 `data.timestamp`（毫秒） |
| 营收同比 | `GET /api/a-share/financials/indicators?thscode=...&report=yyyy-N` | 文档写 `operating_income_yoy_growth_ratio`；**实盘返回** `calculate_operating_income_yoy_growth_ratio` |
| 波动率 | `GET /api/a-share/prices/historical` | 用近约 20 根日线 `close_price` 对数收益年化 |

鉴权：请求头 `X-api-key`（与 MCP 环境变量 `API_KEY` 同值）。

### 核对样例（贵州茅台 `600519.SH`）

在配置真实 Key 后实测：

- `pe_ttm` = `22.605792`（倍）
- `data.timestamp` → 约 `2026-11-20`
- 页面来源文案：`扶摇 REST API`
- 营收同比：实盘 `calculate_operating_income_yoy_growth_ratio` ≈ `-1.206004`（%）
- 近20日波动率：由 K 线推算 ≈ `26.27`（%）

### 候选人修正的不合理结果

1. 纠正错误 REST 路径，改为官方 `a-share/valuations|financials|prices`。
2. 发现文档字段名与实盘不一致后，代码同时兼容 `operating_income_yoy_growth_ratio` 与 `calculate_*` 前缀。
3. 报告期默认过新导致空值时，支持 `FUYAO_REPORT`（如 `2025-4`）。
4. 无 Key / 调用失败时强制标注演示数据或失败原因，禁止静默“正常”。
5. 默认营收阈值由 `>10` 调整为 `>0`，避免真实样本下首次入选为空，便于验收进出名单。
6. Next.js `15.5.4` 被 Vercel 安全拦截 → 升级至 `15.5.7` 后 Production Ready。

## 人工 / 规则边界（始终保留）

1. **禁止模型直接荐股**：股票列表只由 `runScreen` 计算。
2. **缺失不得静默通过**：→ `pending` + `missingReason`。
3. **冲突由代码判定**：`detectConflicts`。
4. **事实 / 推断 / 不确定**分开展示；无买卖建议。

## usedLlm=false 说明

线上仅配置了 `FUYAO_API_KEY` 时，澄清接口返回 `usedLlm=false` **符合设计**：条件草稿用规则引擎，筛选仍用扶摇真实数据。若需 LLM 起草条件，在 Vercel 增加 `OPENAI_API_KEY` 并 Redeploy。

## 验证方式

见 `docs/TEST_NOTES.md`；线上主链路与扶摇 PE 字段已人工核对。
