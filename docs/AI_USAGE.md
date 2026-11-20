# AI 使用与验证记录

## 使用的 AI 工具

- Cursor Agent（Composer）：项目脚手架、主链路代码、UI 与文档初稿。
- 可选运行时 LLM（`OPENAI_API_KEY`）：仅用于条件草稿 JSON；默认不启用。

## AI 参与的环节

1. 生成 Next.js + TypeScript 项目结构与页面流程。
2. 设计条件 schema、确定性筛选引擎与冲突规则。
3. 编写演示数据、扶摇客户端回退逻辑与 README。

## 人工 / 规则修正的要点

1. **禁止模型直接荐股**：股票列表必须由 `runScreen` 引擎计算。
2. **数据缺失不得静默通过**：缺失 → `pending`，并展示 `missingReason`。
3. **冲突由代码判定**：`detectConflicts` 不依赖 LLM。
4. **无 Key 时明确标注演示数据**，避免伪装成实时行情。
5. **合规文案**：固定免责声明，区分事实 / 推断 / 不确定。

## 验证方式

见 `docs/TEST_NOTES.md`；本地以 `npm run build` 与浏览器主链路操作为准。
