# 自然语言智能选股与策略解释器（题目 02）

将模糊选股意图（如「经营改善、估值合理、走势稳定」）转为**可检查、可修改、可执行**的数据条件，用确定性引擎筛选股票，并解释入选 / 排除 / 待确认依据。修改阈值后可对比名单进出。

> **合规**：不输出买卖建议、涨跌预测或收益承诺。数据缺失会显示原因，不会静默当成“通过”。

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

> 说明：当前环境若遇 npm `ECONNRESET`，可用已验证可构建的副本目录 `d:\nl-stock-picker`（与本仓库源码同步）；`node_modules` 已通过目录联接指向该处。

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
4. Deploy。部署后打开线上 URL，走一遍澄清 → 筛选验收。

## 产品怎么用

1. 输入意图（默认可直接用「经营改善、估值合理、走势稳定」）。
2. 点击 **澄清意图并生成条件草稿** → 看到澄清问题与三个条件卡。
3. 在条件卡中修改运算符 / 阈值 / 启用开关（冲突会即时提示）。
4. 点击 **执行筛选** → 查看每只股票的实际值、阈值、来源、时点与判定。
5. 再改一个阈值并再次筛选 → 顶部「条件变化影响」显示新进 / 退出名单。

## 职责边界

| 角色 | 做什么 |
|------|--------|
| AI / 规则起草 | 意图澄清问题、条件 JSON 草稿 |
| 确定性引擎 (`src/lib/engine.ts`, `conflicts.ts`) | 冲突识别、是否满足条件、入选/排除/待确认、名单 delta |
| 数据层 (`src/lib/fuyao.ts`, `demo-data.ts`) | 扶摇优先；失败或无 Key 时回退演示数据并写明原因 |

## 第一版指标

1. **营收同比** `revenue_yoy`
2. **PE(TTM)** `pe_ttm`
3. **近 20 个交易日年化波动率** `volatility_20d`

## 已知边界 / 未做事项

- 扶摇真实字段名因租户而异：需按[扶摇文档](https://fuyao.aicubes.cn/docs/)调整 `FUYAO_SNAPSHOT_PATH` 与字段映射。
- 未接 iFinD MCP、完整回测与监控任务（可二期扩展）。
- 演示股票池约 15 只，便于无 Key 时跑通主链路。
- LLM 仅起草条件，**从不直接输出荐股列表**。

## 测试说明（摘要）

- **主链路**：默认意图 → 澄清 → 筛选 → 可见入选/排除/待确认。
- **数据缺失**：演示标的 `DEMO.MISS` 营收同比缺失 → 状态为「待确认」并写明原因。
- **接口失败**：错误配置 Key 时 API 返回失败说明并回退演示数据，不伪造“正常空结果”。
- **合规**：页面固定免责声明；无买卖按钮与收益承诺文案。

## 技术栈

Next.js 15 (App Router) + TypeScript + 原生 CSS + 服务端 Route Handlers。
