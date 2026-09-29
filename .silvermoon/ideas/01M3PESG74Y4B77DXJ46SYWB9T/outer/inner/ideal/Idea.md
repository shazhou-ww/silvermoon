# 让内容语言贯穿所有 idea 合同

## 意图

让 Silvermoon 创建和导航 idea 时，明确且一致地要求所有世界合同与 ledger 的
自然语言内容遵循当前 idea 的有效内容语言，而不是只让 `Idea.md` 遵循该语言。

## 背景

`create-idea` 会解析并报告有效内容语言，也会把显式 `--language` 持久化到
`status.yaml`，但当前脚手架始终从一组硬编码英文模板生成 `Idea.md`、
`Implementation.md`、`Deployment.md` 和 `ledger.md`。因此，即使报告明确显示
`contentLanguage: zh-CN`，新建 idea 的合同和占位仍然是英文。

Silvermoon skill 说明了内容语言的来源与持久化方式，却没有明确规定三个世界合同
及 ledger 的自然语言必须遵循有效内容语言；其中对 `## Steps` 和
`## Acceptance criteria` 的固定英文表述还可能被 Agent 理解为必须保留英文标题。
`whats-next` 虽然在详情中暴露内容语言，但生命周期 next step 只说明应编辑哪些
路径，没有把内容语言转化为当前操作要求。现有测试也只验证语言状态和报告输出，
没有验证新建文件或生命周期指令的语言一致性。

## 期望结果

- `create-idea` 生成的 `Idea.md`、`Implementation.md`、`Deployment.md` 和
  `ledger.md` 不再与有效内容语言冲突；至少对内置支持的中文和英文提供一致模板。
- 对于无法由内置模板直接呈现的 canonical BCP 47 内容语言，行为必须明确且不能
  静默声称英文占位符合指定语言，并为 Agent 提供可执行的语言转换要求。
- Silvermoon skill 明确规定所有世界合同、同世界辅助文件和 ledger 中的自然语言
  都使用报告中的有效内容语言；稳定 ID、路径和 canonical 结构标题等 schema
  标识不翻译，并明确区分结构标识与自然语言内容。
- `whats-next` 为选中 idea 生成 lifecycle next step 时，明确指出当前有效内容语言，
  并要求 Agent 使用该语言编写当前阶段允许修改的合同和 ledger 内容。
- 临时 output language 只控制 Silvermoon 自身报告的呈现，不得改变 next step 中
  指定的内容语言。
- 回归测试覆盖中文脚手架、非中文内容语言的明确行为、skill 文档，以及 output
  language 与 content language 不同的 `whats-next` 指令。

## 范围

### 范围内

- 为 idea 脚手架建立基于有效内容语言的模板选择或等价生成机制。
- 更新 `create-idea` 的报告与测试，验证所有生成文件的语言行为。
- 更新 canonical Silvermoon skill 及其发布副本，写清内容语言对所有世界的约束。
- 更新 `whats-next` lifecycle instruction，使内容语言成为显式、实时的执行要求。
- 更新相关参考文档和回归测试，防止内容语言与临时输出语言重新混淆。

### 范围外

- 改变内容语言的优先级：仍为 idea、project、user、`en-US`。
- 限制 `create-idea --language` 当前接受的 canonical BCP 47 tag 范围。
- 使用在线翻译服务、模型调用或运行时外部命令生成脚手架。
- 改变稳定 ID、生命周期 revision、状态判定或四投影 command report 结构。
- 发布新的 npm package 版本；本 idea 只修改并验证仓库内容，不执行 npm 发版。

## 约束

- `configuration.preferredLanguage` 继续表示解析后的有效内容语言，
  `outputLanguage` 继续只表示当前命令的内置输出 locale。
- `whats-next --language` 不得覆盖或掩盖 next step 中的内容语言要求。
- 模板、skill、文档和测试必须使用同一套术语，不能把“报告语言”误写成“内容语言”。
- 生成器无法本地化任意 BCP 47 tag 时必须给出诚实、可执行且可测试的行为，不得
  静默回退后仍暗示生成内容符合指定语言。
- stable ID、文件名、CLI 参数、canonical 结构标题和 schema 字段等机器契约
  保持不变。
