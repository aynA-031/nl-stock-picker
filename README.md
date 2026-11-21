# 自然语言智能选股与策略解释器（题目 02）

将模糊选股意图（如「经营改善、估值合理、走势稳定」）转为**可检查、可修改、可执行**的数据条件，用确定性引擎筛选股票，并解释入选 / 排除 / 待确认依据。修改阈值后可对比名单进出。

> **合规**：不输出买卖建议、涨跌预测或收益承诺。数据缺失会显示原因，不会静默当成“通过”。

## 交付链接

- 产品网页：https://nl-stock-picker.vercel.app/
- 源代码仓库：https://github.com/aynA-031/nl-stock-picker

## 快速开始

```bash
# 若 npm 因网络中断失败，可在本机用镜像重试：
# npm install --registry=https://registry.npmmirror.com
npm install
npm run dev
```

浏览器打开：[http://localhost:3000](http://localhost:3000)

```bash
npm run build   # 生产构建检查
npm start       # 生产模式
```

## 环境变量

复制 `.env.example` 为 `.env.local`：

| 变量 | 是否必须 | 说明 |
|------|----------|------|
| `FUYAO_API_KEY` | 否* | 扶摇 API Key（REST 请求头 `X-api-key`）；**不配则演示数据** |
| `API_KEY` | 否* | 官方 MCP 变量名，与上者同值亦可；网页客户端会回退读取 |
| `FUYAO_BASE_URL` | 否 | 默认 `https://fuyao.aicubes.cn` |
| `FUYAO_UNIVERSE` | 否 | 逗号分隔 thscode，如 `600519.SH,000858.SZ` |
| `FUYAO_REPORT` | 否 | 财务指标报告期 `yyyy-1`…`yyyy-4` |
| `OPENAI_API_KEY` | 否 | 有则用 LLM 起草条件；无则本地规则启发式 |
| `OPENAI_BASE_URL` / `OPENAI_MODEL` | 否 | 兼容 OpenAI 协议的网关与模型名 |

\* 二选一配置即可。签发入口：[扶摇快速开始](https://fuyao.aicubes.cn/docs/quickstart/)。  
PE 官方字段：`GET /api/a-share/valuations/snapshot` → `data.item[].pe_ttm`，日期取 `data.timestamp`（毫秒）。

**不要把真实 Key 提交到公开仓库。** `.env.local` 已在 `.gitignore` 中忽略；仓库只保留 `.env.example`。

### 部署到 Vercel

1. 将本仓库导入 [Vercel](https://vercel.com/new)（Import Git Repository）。
2. Framework Preset 选 **Next.js**，根目录保持默认。
3. 在 **Environment Variables** 添加：
   - `FUYAO_API_KEY` = 你的扶摇 Key（Production / Preview 都建议勾选）
   - 可选：`FUYAO_BASE_URL`、`FUYAO_UNIVERSE`、`FUYAO_REPORT`
   - 可选（澄清用 LLM，未配则 `usedLlm=false` 走本地规则）：`OPENAI_API_KEY`，以及 `OPENAI_BASE_URL` / `OPENAI_MODEL`
4. Deploy。修改环境变量后需 **Redeploy**。打开线上 URL，走一遍澄清 → 筛选验收。

## 产品怎么用

1. 输入意图（默认可直接用「经营改善、估值合理、走势稳定」）。
2. 点击 **澄清意图并生成条件草稿** → 看到澄清问题与条件卡。
3. 在条件卡中修改运算符 / 阈值 / 启用开关（冲突会即时提示）。
4. 点击 **执行筛选** → 查看每只股票的实际值、阈值、来源、时点与判定。
5. 再改一个阈值并再次筛选 → 顶部「条件变化影响」显示新进 / 退出名单。

## 当前支持的指标（MVP）

| 指标 ID | 含义 | 典型运算符 | 数据来源 |
|---------|------|------------|----------|
| `revenue_yoy` | 营收同比增速 | `>` / `>=` | 扶摇财务指标 |
| `pe_ttm` | 市盈率（TTM） | `between` | 扶摇估值快照 |
| `volatility_20d` | 近 20 日年化波动率 | `<` / `<=` | 扶摇历史 K 线（需 21 根有效收盘价） |

澄清与筛选**只**围绕上述三项。`/api/screen` 对 `conditions` / `previousConditions` 做运行时校验：ID 白名单、`field`≡`id`、`op` 枚举、`value` 须为有限数字；`between` 还要求有限 `valueMax` 且下限≤上限。非法请求返回 **HTTP 400** 并指出具体字段。

## 已知限制

- **不支持** ROE、负债率/资产负债率、分红/股息、市净率、毛利率、现金流、市值/成交额等；意图中出现时会在澄清卡以红字列入 `unsupportedAspects`，混合意图只生成已支持部分；若全部不支持则提示改写意图。
- 股票池为配置的 A 股子集（演示约 15 只；真实模式由 `FUYAO_UNIVERSE` 决定），不是全市场扫描。
- 合法条件筛出 0 只且数据可用（存在可判定的排除结果）时，保留原条件并提示「当前股票池下没有命中，阈值可能过严」。若股票池全部待确认（字段缺失），则提示数据缺失/待确认，不提示过严。接口失败另示原因。LLM 草稿阈值有明确数值范围（如波动率上限不可为负），越界回退默认并说明。
- Serverless 下内存快照可能无法跨实例复用：此时用同一份新数据分别跑旧/新条件再算进出，并提示「已刷新数据，前后条件均按新快照重算」。
- LLM 仅起草条件阈值；无效阈值回退 `defaults.ts` 默认值并在草稿中提示。**从不直接输出荐股列表**。
- 未接 iFinD MCP、完整回测与监控任务（可二期扩展）。

## 职责边界

| 角色 | 做什么 |
|------|--------|
| AI / 规则起草 | 意图澄清问题、条件 JSON 草稿、不支持指标提示 |
| 确定性引擎 (`src/lib/engine.ts`, `conflicts.ts`) | 冲突识别、是否满足条件、入选/排除/待确认、名单 delta |
| 入参校验 (`src/lib/validate-conditions.ts`) | `/api/screen` 运行时校验，拒绝非法阈值 |
| 数据层 (`src/lib/fuyao.ts`, `demo-data.ts`) | 扶摇优先；失败或无 Key 时回退演示数据并写明原因 |

## 测试说明（摘要）

详见 `docs/TEST_NOTES.md`。关键验收：

- 主链路：默认意图 → 澄清 → 筛选 → 入选/排除/待确认。
- 非法 `value: "abc"` / 倒置区间 → HTTP 400。
- 过严合法条件 → 0 命中提示。
- 「ROE / 负债率 / 连续分红」→ 红字列出不支持项。
- 合规：「明天必涨」类意图被拒绝。

## 技术栈

Next.js 15 (App Router) + TypeScript + 原生 CSS + 服务端 Route Handlers。
