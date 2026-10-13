# 专业能力 module

本仓库内的 [module](../src/professional-model/index.ts) 提供能力定义及
`assembleProfessionalModel`，暂不作为独立 npm 包或公共 package export。
它只组织判据与指导，不执行 skill、不代替 Agent 解题，也不产生人工决定。
本次仅验证 Silvermoon 场景，不据此宣称跨行业普适性。它现在是保留的兼容基线；
实际导航已迁移到 [Objective Guide runtime](./objective-guidance.md)。

## 公共契约

- `Target = Readonly<Record<string, unknown>>`，不暴露泛型。YAML 的 `target`
  声明字段类型：`string`、有限 `number`、`boolean` 及其 `optional-` 形式。
  必需字段须是对象自身字段；未声明字段允许保留。目标不是完整世界状态。
  目标非 key-value 对象或字段类型错误抛出 `TargetError`，不作为业务未达成。
- `observe(target)` 返回 `{ level, problems }`。层级为从 0 开始的连续非负整数，
  非空且最高层唯一；问题包含非空 `code` 与 `description`。
- `guide(code)` 统一返回注册的惰性 **skill 内容字符串**，内容可引用文档。
  未知 code 返回显式提示知识缺口的内容，不自动解析文档引用或执行指导。
- `describe()` 返回不可变的有序层级说明；无问题不等于一定处于最高层。

## 声明与执行

YAML 必须包含且仅包含 `target`、`levels`、`checks`、`skills`、`guidance`
和 `unknown`。`skills` 注册名称到内容字符串，`guidance` 将 problem code
映射到注册名称，`unknown` 指定兜底 skill；失效引用是配置错误。
严格 YAML 解析拒绝重复 key、脚本外的未知配置字段、tag、alias 等。

`checks` 为二维检查名称数组，位置 0 表示 0→1，位置 1 表示 1→2，
组数必须等于层级数减一。每次 `observe` 调用 registry factory，先验证
所有检查引用，再从 0 顺序执行。层内首失败停止，全部通过才升级；
空组自然通过，只有 0 层的定义也有效。

Registry factory 接收运行器为本次观察提供的 `useState`，仅注册状态与检查，
不应在注册时执行采样。`useState(initial)` 返回 `[getState, setState]`：
setter 立即存入给定值，getter 总是读取最新值，包括 `await` 之后。
每次调用分配独立句柄，各 check 通过闭包复用同一句柄来共享状态。
注册结束后不能再调用 useState；运行器不依赖调用顺序索引、全局上下文或 React。
它不调度重渲染，initial 和 setter 参数均为直接值，不解释函数为 initializer
或 updater；需要基于旧值更新时用 `setState(transform(getState()))`。

原子检查接收 Target 并异步返回 `{ passed: true }` 或
`{ passed: false, problems: [problem, ...] }`；非法返回值抛出程序错误。
顺序或并发的新观察均调用 factory 并创建新的 state 句柄，失败的观察也不保留
下次判定所用的状态。句柄不深拷贝 initial 对象；可变初值应在 factory 内
创建，不能以外部可变对象绕过观察隔离。程序异常原样传播，不统一 catch。
预期不可用应由领域检查明确返回 problem。

```ts
const model = assembleProfessionalModel(yamlSource, (useState) => {
  const [getSample, setSample] = useState<string | undefined>(undefined);
  return {
    sample: async (target) => {
      setSample(await readSample(target));
      return { passed: true };
    },
    verify: async () => {
      const sample = getSample();
      return sample === "ready"
        ? { passed: true }
        : {
          passed: false,
          problems: [{ code: "unavailable", description: "Sample is not ready." }],
        };
    },
  };
});
```

此示例的 YAML 需声明 `sample`、`verify` 检查及其层级顺序；运行器不自行重跑
检查，失败后仍需 Agent 采取行动，再发起新的 observe。

观察是采样过程，不保证瞬时一致快照；时效与精确版本判据仍由领域负责。

## Silvermoon 接入边界

[旧导航定义](../src/business/whats-next-model.yaml) 与
[读取函数](../src/business/whats-next-model.ts) 保留为历史兼容资源，不再决定
`whats-next` 的运行顺序。旧 module 契约由
[module 测试](../test/unit/professional-model.test.ts) 独立验证。

现有导航使用 [Device、Project、Idea 定义](../src/business/objective-guides.ts)，
以稳定 level ID、实际 instance 引用和 reference page ID 取代 numeric level、
problem code 路由与惰性 skill 字符串。四投影、控制权、语言与精确 revision
仍由现有报告和 lifecycle reducer 提供；详见
[运行时说明](./objective-guidance.md)和
[导航接入测试](../test/unit/whats-next-model.test.ts)。
