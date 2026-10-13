# Objective Portfolio Supervisor 扩展契约

Objective Portfolio Supervisor（OPS）建立在
[Objective Guide 类型体系](./objective-guidance.md)与
[ObjectiveRegulator](./objective-regulator.md) 之上，监督多个 instance-bound
OR，采集非原子组合观测，并做阈值、资源和时机取舍。Silvermoon 当前不需要实现
OPS。

```ts
type ObjectiveRegistrationId = string;

interface ObjectiveSafetyThresholds {
  // 两个 ID 都属于 registration 的根 instance。
  defensiveThresholdId: ObjectiveLevelId;
  defensiveTargetLevelId: ObjectiveLevelId;
}

interface ObjectiveRegistration {
  id: ObjectiveRegistrationId;
  regulator: ObjectiveRegulator;
  safety: ObjectiveSafetyThresholds;
}

interface ObjectivePortfolioEntry {
  registrationId: ObjectiveRegistrationId;
  // registration 的根 instance；实际来源也在 observation.current.instance。
  instance: ObjectiveGuideInstance;
  observation: ObjectiveObservation;
  safety: ObjectiveSafetyThresholds;
}

interface ObjectivePortfolioObservation {
  // 多个现实样本的组合，不宣称是同一时刻的原子快照。
  entries: readonly ObjectivePortfolioEntry[];
}

type RegulationTrigger = "defensive" | "opportunistic";

interface RegulationDirective {
  registrationId: ObjectiveRegistrationId;
  targetLevelId: ObjectiveLevelId;
  trigger: RegulationTrigger;
  rationale: string;
  limits: RegulationLimits;
}

interface DeferredObjective {
  registrationId: ObjectiveRegistrationId;
  reason: string;
}

interface ObjectivePortfolioPlan {
  // 数组顺序表达调度优先级。
  directives: readonly RegulationDirective[];
  deferred: readonly DeferredObjective[];
}

type ObjectivePortfolioPolicy = (
  observation: ObjectivePortfolioObservation,
) => Promise<ObjectivePortfolioPlan>;

interface ObjectivePortfolioRunResult {
  results: readonly {
    registrationId: ObjectiveRegistrationId;
    result: RegulationResult;
  }[];
}

interface ObjectivePortfolioSupervisor {
  // 使用 registration 的 instance 探测；损益读取 current.advancementOutcome。
  observe(): Promise<ObjectivePortfolioObservation>;

  // 先守防御阈值，再由已注入依赖的 policy 分配预算和窗口。
  plan(
    observation: ObjectivePortfolioObservation,
  ): Promise<ObjectivePortfolioPlan>;

  // 按计划下发给 OR；不修改 OG 的层级、checks 或 References。
  execute(
    plan: ObjectivePortfolioPlan,
    executeAction: ObjectiveActionExecutor,
  ): Promise<ObjectivePortfolioRunResult>;
}
```

同一 OG 可以创建多个 subject/language-bound instances，所以 OPS 以
`ObjectiveRegistrationId` 调度。Project→Idea 等语义前置由 OG
`prerequisite` 组合，不在 OPS 重复建模。

Portfolio policy 通过自身有类型的构造依赖读取预算、互斥、窗口和其他规划事实，
而不是接收通用 runtime bag；它不能比较或求和不同 Objective 的 level。执行可
串行或受控并发，但必须保留计划优先级、终止保护和独立结果。
