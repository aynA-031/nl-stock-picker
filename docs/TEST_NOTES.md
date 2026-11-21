# 测试说明

线上：https://nl-stock-picker.vercel.app/  
仓库：https://github.com/aynA-031/nl-stock-picker

## 1. 主流程（扶摇真实数据）

1. 打开线上地址，意图「经营改善、估值合理、走势稳定」。
2. 点「澄清意图并生成条件草稿」→ 出现条件卡。
3. 点「执行筛选」。
4. 期望：数据模式为「扶摇真实数据」；每只股票展示实际值、阈值、来源、时点。
5. **营收同比时点**：应为「报告期 yyyy…」；若有披露日则含「公告日 yyyy-mm-dd」。
6. **波动率**：基于 21 个有效收盘价计算近 20 日年化波动；不足时「待确认/缺失」并写明实际根数。
7. 改营收同比阈值（如 `0` → `10`）后再筛：给出新进/退出名单。
   - **快照可复用**：`dataAlerts` 含「同一数据快照」；前后条件在同一行情/财务口径上对比。
   - **快照无法复用**（过期、多实例内存 miss 等）：同一份**新**数据上分别跑旧条件与新条件再算进出；`dataAlerts` 含「已刷新数据，前后条件均按新快照重算」。

### 实测记录（本地/线上扶摇）

| 项 | 结果 |
|----|------|
| 贵州茅台 PE(TTM) | 原始字段 `pe_ttm` ≈ 22.61；来源扶摇 REST |
| 营收同比 | 字段 `calculate_operating_income_yoy_growth_ratio`；报告期由 `FUYAO_REPORT`（如 2025-4）展示；公告日来自利润表 `report_date_ms`（有则显示） |
| 名单对比（快照命中） | 线上连续两轮：第二轮 `dataAlerts` 含「同一数据快照」；delta 正常（如营收阈值 0→10 可出现退出） |
| 名单对比（快照失效） | 线上用失效 `snapshotId`：`dataAlerts` 首条为「已刷新数据，前后条件均按新快照重算」；在同一新快照上重跑旧/新条件后再算进出 |

## 2. 字段缺失

1. 演示池 `DEMO.MISS`：营收缺失 + 波动率不足 21 根 → 状态「待确认」，不得入选。
2. 真实模式下某字段为空：对应条件 `passed=null`，summary 说明缺失原因。

## 3. 接口失败

1. 无 `FUYAO_API_KEY`：演示数据 + 明确红字提示。
2. Key 无效 / 上游失败：提示「扶摇调用失败…已回退演示数据」，不静默成功。

## 4. 合规：输入「给我一只明天必涨的股票」

**实测表现：**

1. 点澄清后返回 `complianceBlocked=true`。
2. 页面红字说明：拒绝涨跌预测与买卖建议。
3. `usedLlm=false`（合规短路，不调用模型荐股）。
4. 仍可给出默认可编辑条件卡，但文案强调仅事实筛选、非投资建议。
5. 不会输出“必涨”标的列表。

## 5. 线上澄清 `usedLlm`（实测）

| 场景 | 实测 |
|------|------|
| 正常意图「经营改善、估值合理、走势稳定」 | **`usedLlm=true`**（Production 已配置 `OPENAI_API_KEY`） |
| 合规意图「给我一只明天必涨的股票」 | **`usedLlm=false`** + `complianceBlocked=true`（合规短路，不调用模型荐股） |
| 筛选 | `dataMode=fuyao`，返回 `snapshotId`；营收同比时点含报告期与公告日 |

Vercel 配置页：项目 → Settings → Environment Variables → `FUYAO_API_KEY` / 可选 `OPENAI_API_KEY`。

## 6. 冲突 / 保存策略 / 合规文案

- PE 下限>上限 → 冲突错误；关闭全部条件 → 错误级冲突。
- 可保存/加载策略（localStorage）。
- 页脚免责声明；无买入卖出按钮。

## 7. 评审修复实测（入参校验 / 0 命中 / 不支持指标）

### 7.1 `/api/screen` 运行时入参校验 → HTTP 400

| 用例 | 请求要点 | 本地实测 | 线上复测（Production，提交 `a4b3742`） |
|------|----------|----------|----------------------------------------|
| `value: "abc"` | `conditions[0].value="abc"` | **HTTP 400**；`error`: `conditions[0].value 必须是有限数字，收到 "abc"` | **HTTP 400**；同文案 |
| 倒置区间 | `pe_ttm` `op=between` `value=35` `valueMax=8` | **HTTP 400**；区间倒置说明 | **HTTP 400**；`下限 value=35 大于上限 valueMax=8` |
| 共用规则 | `previousConditions` 与 `conditions` 同一套校验 | 非法对比条件同样 400 | 同左 |

### 7.2 模型阈值范围 + 0 命中 / 全部待确认（评审 ② 补齐）

前后端共用 `src/lib/screen-outcome.ts` 的 `classifyScreenOutcome`：**仅当数据可用且存在 excluded、selected=0** 时提示「阈值可能过严」；**全部待确认**时提示数据缺失/待确认，不提示过严。

| 用例 | 做法 | 实测 |
|------|------|------|
| 模拟模型「波动率上限 -1%」 | `applyLlmDraftPatches({ volatility_20d: { op:"<", value:-1 } })` | 回退默认 `< 35%`；`draftNotes` 含「超出允许范围 [0.1, 200]%」与「已回退为默认」 |
| 指标数值范围 | `LLM_THRESHOLD_RANGES`：营收同比 [-100,500]%；PE [0,200] 倍；波动率上限 [0.1,200]% | 写入 `validate-conditions.ts`，LLM system prompt 同步提示 |
| 过严阈值（有数据） | 营收 `>999`、PE `1~2`、波动 `<1` | **HTTP 200**；`excluded>0`；alerts 含「当前股票池下没有命中，阈值可能过严」 |
| **8 只全部待确认** | 引擎合成 8 只字段全缺失股票 + `withOutcomeAlert` | `counts.pending=8`；kind=`all_pending`；tip 含「8 只全部待确认（数据缺失或字段不足）」；**不含**「阈值可能过严」 |
| 数据失败 | 扶摇失败/回退演示 | kind=`data_unavailable`，展示失败原因 |

本地脚本：`npx tsx scripts/verify-review2.mts`（全部断言通过）。

### 7.3 `unsupportedAspects` 澄清红字

| 用例 | 意图 | 本地实测 | 线上复测（Production，提交 `a4b3742`） |
|------|----------|----------|----------------------------------------|
| 全部不支持 | 「ROE 大于 15%、负债率低于 40%、连续分红」 | `unsupportedAspects` 含 ROE / 负债率 / 分红；`conditions=[]` | 同左：`["ROE（净资产收益率）","负债率 / 资产负债率","分红 / 股息"]`；`conditions=[]` |
| 混合意图 | 含已支持 + 不支持 | 只生成受支持条件；红字列出不支持项 | 同左 |

`npm run build`：通过（exit 0）。  
线上功能验收提交：`a4b3742`（Vercel Production Ready）。  
交付文档补记提交见本仓库后续 `docs` 提交。
