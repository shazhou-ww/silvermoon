# 建立 Agent Session Trajectory 评估基线

## 问题

现有确定性测试能验证 Silvermoon CLI，却不能证明真实 Agent 会话会保留用户意图、
遵守只读边界，并在准确候选的人类审批关口停止。只看最终回复或仓库结果，也会漏掉
执行途中发生后又被撤销的违规。

## 结果

采用 Harbor 与其内置 `copilot-cli` 适配，在隔离环境中运行当前 checkout 的
Silvermoon package 和 canonical skill，以可见工具轨迹和仓库事实确定性验证单轮、
跨轮及准确 revision 的审批行为。[方案与首版场景](./Harbor-evaluation-plan.md)
定义复用边界、七组评估场景和证据要求；不是通用模型 benchmark。

## 边界

- 首版使用本地 Docker、Harbor 和真实 Copilot CLI；不自行建设通用 runner、评分平台
  或多 runtime 支持，不把 CLI 结果等同于 VS Code Copilot Chat 行为。
- 不改变生产 CLI、schema、生命周期或人类批准规则；只在 disposable checkout、
  隔离用户配置与 disposable remote 中执行，不操作真实发布目标或用户工作区。
- Hard invariant 由确定性校验与完整的必要证据判定，不用 LLM judge、自然语言
  golden transcript、Agent 自述或重试后的成功代替；不保存隐藏推理或秘密。

## 验收标准

- 文档化命令支持指定场景、完整场景集和显式重复次数；七组场景均有真实会话结果，
  并有能检出对应违规的 verifier 自测。
- 同一原生 session 能经过“提出请求、停在关口、输入准确批准、继续”的完整链路；
  缺失批准、候选变化、错误阶段或不完整证据均不能被误报通过。
- 报告绑定源码、package/skill、Harbor、Copilot CLI 与模型身份，区分
  `pass`、`fail`、`blocked`，保留安全证据；普通 CI 跑确定性自测，受控评估不掩盖失败。

## References

- [方案与首版场景](./Harbor-evaluation-plan.md)
- [Silvermoon skill](../../../../../../skills/silvermoon/SKILL.md)
- [Repository idea workflow](../../../../../../docs/repository-tasks.md)
- [Development validation](../../../../../../docs/maintaining.md)
