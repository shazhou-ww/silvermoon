# Ledger

## Implementation

### Implementation steps

当前 contract 未单独定义 implementation steps。

### Implementation acceptance criteria

- [ ] **I-AC01:** 文档化命令运行 Silvermoon scenario 并显式报告 hard failure
- [ ] **I-AC02:** Canonical runner 授权与 preflight 安全
- [ ] **I-AC03:** Disposable fixture、HOME 和 remote 隔离
- [ ] **I-AC04:** 使用当前 checkout package 与 skill artifact
- [ ] **I-AC05:** Versioned scenario 与 trajectory artifact
- [ ] **I-AC06:** 以 trajectory 和最终仓库证据确定性验证行为
- [ ] **I-AC07:** 首批 Silvermoon 导航、创建、只读与 lifecycle gate 场景
- [ ] **I-AC08:** Focused、full 与 repeated run 支持
- [ ] **I-AC09:** 文档化 session eval 触发条件与 host fidelity boundary
- [ ] **I-AC10:** Agent 确定性验证顺序与失败分类
- [ ] **I-AC11:** 默认测试和 CI 不伪造模型场景通过

## Deployment

### Deployment steps

当前 contract 未单独定义 deployment steps。

### Deployment acceptance criteria

- [ ] **D-AC01:** Repository checks 与 verifier 自测通过
- [ ] **D-AC02:** Canonical Agent 代表性 session 成功
- [ ] **D-AC03:** 发布候选包含 harness、故障注入与文档
- [ ] **D-AC04:** VS Code host smoke 验证真实交互边界

## Preparation evidence

- 2026-09-30（preparing）：Ideal World 契约在 Git tree
  `267c5492ba1554acb430fcc00e80b643adc68d1a` 下审阅。契约以 zh-CN 记录 Goal、
  Context、Scope、Out of scope、Constraints、五个 required human review checkpoint
  与 References，并用首批 Silvermoon navigation、creation、只读与 lifecycle gate
  场景界定评估范围。
- References 中的 candidate runner（Harbor、Promptfoo coding-agent evaluations、
  Inspect AI、AgentEvals）只作为待评估对象；runner、Agent host、模型、trajectory
  schema 与 verifier 边界在 Architecture review 前保持开放，符合 Scope 与
  Constraints。
- 本次只推进 Ideal World 与 ledger：未修改 Implementation.md、Deployment.md、
  status.yaml 或其他 idea，也未新增或改写任何 status revision 事实；仍等待用户对
  精确 idealRevision `267c5492ba1554acb430fcc00e80b643adc68d1a` 的明确批准。
