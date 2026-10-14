# Implementation

## Steps

### I-S01: 建立统一报告投影

组合目标、位置、Problem parameters、Reference guidance、动态上下文和 terminal 状态。

### I-S02: 实现 Objective report shell

用可复用 Markdown/结构组件渲染当前位置与向下指引，并保留必要的特殊交互组件。

### I-S03: 迁移 templates 与语料

逐类替换旧 whats-next templates，更新精确输出测试和 Docker 双语 corpus。

## Acceptance criteria

### I-AC01: 两部分信息完整

contract 测试证明 blocked 报告总能呈现准确位置和对应静态 guidance。

### I-AC02: Terminal 没有伪下一步

Device/Project/Idea terminal 输出明确完成，required actions 为空。

### I-AC03: 模板收敛无回退

catalog 与 corpus 对比证明重复模板减少，动态命令、路径和 review 交互仍准确。
