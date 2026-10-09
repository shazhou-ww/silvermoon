# 实现 Harbor Agent Session 评估基线

准备阶段的轻量初版，仅用于核对可行性，不代表实现已开始或理想契约已批准。
范围以 [Idea.md](./ideal/Idea.md) 和
[方案与首版场景](./ideal/Harbor-evaluation-plan.md) 为准。

## Implementation steps

- **I-S01:** 整备隔离环境与 Harbor Copilot 接入
  - 锁定版本与产物，核对全局 skill 链接、preflight、原生续接及证据采集边界。
- **I-S02:** 建立场景与确定性 verifier
  - 定义版本化场景及安全轨迹，先用合成负例证明规则、观测完整性与状态校验。
- **I-S03:** 接入七组真实评估与开发入口
  - 打通准确批准的跨轮链路，补齐 E01–E07、focused/full/repeated 命令和报告。

## Implementation acceptance criteria

- **I-AC01:** 隔离执行与真实 session 续接
  - 只使用本次构建产物与 canonical skill；写操作不触及真实项目，E04 证明同一
    原生 session 续接；缺少环境或授权时明确 blocked。
- **I-AC02:** 违约与缺证据不误报通过
  - 七组 verifier 负例均能检出违规；包括旧候选批准、间接写入与改后复原，
    隐藏推理与秘密不进入持久产物。
- **I-AC03:** 七组真实场景可重复审计
  - 真实 E01–E07 结果绑定版本与证据，必要步骤全部通过才算 pass；
    fail/blocked 非零退出，重复运行保留每次结果。
