# Implementation

## Steps

### I-S01: 建立专业能力 module

依据[导向模型](./ideal/professional-model.md)在仓库内独立 module 定义固定 Target、Problem、Observation 与能力接口。严格验证 YAML 层级、检查引用顺序、code 到注册 skill 的映射，以及目标字段；guide 统一返回惰性 skill 内容字符串（可含文档引用），未知 code 明确提示知识缺口。逐关异步执行，首失败停止；每次 observe 向检查注册函数注入 useState，各 check 共享显式注册的 `[getState, setState]` 句柄，setter 立即更新、getter 读取最新值，不模拟 React 重渲染或依赖隐式全局上下文。

### I-S02: 适配 what's next

把现有导航整备、选取、guidance 与生命周期推进改为注册原子检查，由拼装执行函数组织执行，不增加平行判断。导航 YAML 独立成文件，按 module 相对路径读取，并覆盖构建复制与安装包资源边界；所有跨 check 的可变状态及报告结果通过观察内 useState 句柄管理。复用领域报告和精确版本判据，保留四投影、优先级、控制权、语言、Git/schema 整备与非阻塞设备 advisory；不自动执行 skill、不替代人工接受。

### I-S03: 验证并记录抽象边界

补充抽象及真实导航适配测试，更新直接相关文档。以已批准 Idea 为边界，不修改 ideal 或预写部署；保持三个高层步骤与三个标准，仅因实际复杂度增加辅助文件。简短验证结论与精确命令结果持久写入主体世界证据文件，ledger 仅镜像稳定 ID，不复制日志；只证明 Silvermoon 场景可用。

## Acceptance criteria

### I-AC01: 拼装语义可验证

专项测试覆盖检查顺序、首失败停止、空组及全部通过、0 级兜底、非空问题、未知 code 指导、配置与目标错误、多个 state 句柄独立、异步更新后的最新值、观察内共享及顺序/并发观察隔离；注册结束后不允许新增 state。预期不可用显式报告，程序缺陷不被 broad catch 吞掉。

### I-AC02: 导航行为兼容

针对整备、选取 Idea、guidance、生命周期与人工或外部等待的专项及现有兼容测试证明实际经过新抽象与注入的 state 机制；验证源文件、build 和安装包均读取独立 YAML，读取/解析错误明确传播而非使用旧内嵌配置。保持报告形状、优先级、语言、非阻塞 advisory 和精确 revision、提交、接受同步语义。观察是过程，跨观察不复用通过结论。

### I-AC03: 仓库验证通过

通过 `pnpm check:sanity`、变更专项测试、交付前 `pnpm check` 与提交前 `pnpm check:commit`，记录精确命令与结果；通过全局运行时的 worktree/staged 元数据检查后普通提交及非强制同步，再对准确 implementationRevision 记录 submitInner，不进入部署或推断 acceptInner。

## Evidence

三个步骤与三个标准的实现结论、精确验证命令及适用边界见[实现证据](./implementation-evidence.md)；
技术契约见[专业能力说明](../../../../../docs/professional-model.md)。
