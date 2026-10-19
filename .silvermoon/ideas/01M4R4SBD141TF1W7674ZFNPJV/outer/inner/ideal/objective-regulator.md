# ObjectiveRegulator 扩展契约

ObjectiveRegulator（OR）建立在
[Objective Guide 类型体系](./objective-guidance.md)之上，为一个
`ObjectiveGuideInstance` 提供框架持有的探测、Agent 单步行动、复测和终止保护。
Silvermoon 当前的 `whats-next` 只需要 Guide instance，不需要实现 OR。

```ts
interface RegulationLimits {
  maxIterations: number;
  timeoutMs: number;
  maxStalledIterations: number;
}

interface ObjectiveActionRequest {
  targetLevelId: ObjectiveLevelId;
  observation: ObjectiveObservation;
  problem: ObservedProblem;
}

type ObjectiveActionResult =
  // completed 只表示动作结束；是否进展由下一次 probe 判断。
  | { status: "completed"; summary: string }
  | { status: "blocked"; reason: string };

type ObjectiveActionExecutor = (
  request: ObjectiveActionRequest,
) => Promise<ObjectiveActionResult>;

interface RegulationRequest {
  targetLevelId: ObjectiveLevelId;
  limits: RegulationLimits;
}

type RegulationStatus =
  | "target-reached"
  | "no-actionable-problem"
  | "action-blocked"
  | "no-progress"
  | "max-iterations"
  | "timed-out";

interface RegulationResult {
  status: RegulationStatus;
  targetLevelId: ObjectiveLevelId;
  iterations: number; // 已请求的 Agent 动作次数
  latestObservation: ObjectiveObservation;
}

interface ObjectiveRegulator {
  readonly instance: ObjectiveGuideInstance;

  // 仅探测；不会调用 Agent。
  probe(): Promise<ObjectiveObservation>;

  /**
   * 框架持有循环：
   * 1. probe；
   * 2. current 已到达 targetLevelId 或其后的 description 时结束；
   * 3. 取首个问题；Agent 通过 current.instance 查询 page；
   * 4. Agent 只执行一次现实动作；
   * 5. 重新 probe；
   * 6. 应用超时、迭代和连续无进展保护。
   */
  regulate(
    request: RegulationRequest,
    executeAction: ObjectiveActionExecutor,
  ): Promise<RegulationResult>;
}
```

`targetLevelId` 必须解析到 `instance.describeLevels()` 中同时满足
`description.instance === instance` 的显式层或 terminal；数组顺序只表达先后，
不作为公共 index。当前 observation 来自 prerequisite instance 时，它位于所有
根 instance 本地目标之前；若要以 prerequisite 的中间层为目标，应直接为该
instance 创建 OR。

OR 不强制追求 terminal。Page 查询属于一次行动的认知过程，不额外增加
iteration；未建模异常必须 reject，不能包装成 `RegulationStatus` 的成功形状。
