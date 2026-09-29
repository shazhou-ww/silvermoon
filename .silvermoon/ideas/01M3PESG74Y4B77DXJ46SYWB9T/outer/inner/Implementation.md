# Implementation

## Steps

### I-S01: 按有效内容语言生成脚手架

把 idea 模板从固定英文常量改为基于有效内容语言选择的生成结果。保留文件路径、
stable ID 和 canonical 结构标题；对内置支持的英文与中文生成对应语言的自然语言
标题、说明、注释和占位内容。`create-idea` 必须把观察得到的有效内容语言传给模板
生成逻辑，而不是只记录在 action 和 response 中。

对于不属于内置模板 locale 的 canonical BCP 47 tag，继续允许创建 idea，但必须
采用明确、可测试且不冒充目标语言的 fallback：保留 canonical 最小结构，并在
`create-idea` next step 中明确要求 Agent 使用精确内容语言替换自然语言占位后再
推进。不得调用在线翻译或外部 renderer。

### I-S02: 在 lifecycle next step 中声明内容语言

让 `whats-next` 的 lifecycle instruction 同时接收有效内容语言和输出语言。输出语言
仍只决定 Silvermoon 指令本身如何呈现；指令内容必须明确要求 Agent 使用
`configuration.preferredLanguage` 编写当前阶段允许修改的合同、辅助文件和 ledger
自然语言内容，并说明 canonical 结构标题、stable ID 与机器字段保持不变。

### I-S03: 收紧 canonical skill 与操作文档

更新 canonical Silvermoon skill，明确三个世界合同、同世界辅助文件和 ledger 的
自然语言内容必须遵循当前报告中的有效内容语言，并区分内容语言、临时输出语言和
不可翻译的机器契约。通过仓库既有同步机制更新 skill 发布副本，并同步调整直接
说明语言行为的参考文档。

### I-S04: 建立跨表面的语言回归覆盖

扩展 `create-idea`、`whats-next`、skill contract 和文档测试。覆盖中文脚手架、
英文脚手架、任意 canonical 内容语言的显式 fallback，以及
`outputLanguage !== contentLanguage` 时 lifecycle next step 仍指定正确内容语言。
验证四个生成文档的自然语言占位及 ledger 镜像保持同步。

## Acceptance criteria

### I-AC01: 中文 idea 不再生成英文自然语言占位

在 `preferredLanguage: zh-CN` 或显式 `create-idea --language zh-CN` 的 fixture 中
创建 idea 后，四个 canonical Markdown 文件的说明、注释、步骤名、标准名和占位
正文均为中文；canonical 结构标题和 stable ID 保持有效。集成测试读取并断言每个
生成文件，同时 `silvermoon check --worktree` 验证完整布局。

### I-AC02: 非内置内容语言不会被静默误表示

使用至少一个非内置 canonical BCP 47 tag 创建 idea 时，命令仍保留该 tag，但响应
必须明确说明模板 fallback 以及 Agent 应使用的精确内容语言；测试证明输出没有把
英文 fallback 描述为已符合目标语言。

### I-AC03: whats-next 实时给出正确内容语言

对 preparing、implementing 和 deploying 状态分别运行 `whats-next`，next step
都明确包含解析后的内容语言。再用与内容语言不同的临时 `--language` 运行，测试
证明报告 framing 随 output language 改变，但内容编写要求仍指向原内容语言。

### I-AC04: skill、文档与实现保持一致

canonical skill 与发布副本都明确说明内容语言约束和机器契约例外，相关参考文档
不再暗示 `--language` 只影响 `Idea.md`。`pnpm check:skills` 与 `pnpm check`
全部通过，证明 skill 同步、文档契约及完整回归套件有效。
