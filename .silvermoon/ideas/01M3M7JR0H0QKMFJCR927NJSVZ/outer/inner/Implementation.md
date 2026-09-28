# 主体实现契约

## Steps

### I-S01: 统一正式文档与 skill 的世界术语

在 README 和历史 idea 之外，将“道心”“内景”“现世”替换为 Ideal World
（理想世界）、Inner World（主体世界）、Outer World（现实世界），并在指代
三个规范入口文件时分别使用理想契约、主体实现契约和现实部署契约。保持
canonical skill、安装副本及其参考资料同步，不移除三重世界、嵌套关系或
world revision 的设计语言。

### I-S02: 更新 CLI 与用户可见元数据

更新布局 display name、中文导航和创建指导等用户可见文本，使 CLI 不再把
仙侠别名作为正式概念，同时保持路径、schema 字段、revision 计算和 lifecycle
行为不变。

### I-S03: 调整契约测试并验证术语边界

更新依赖旧别名的测试断言，增加或调整覆盖以证明正式界面采用新名称、两份
README 仍可保留仙侠品牌文案，并确认历史 idea 不因本次术语迁移被改写。

## Acceptance criteria

### I-AC01: 正式界面不再使用仙侠别名

当前规范文档、canonical skill 及其安装副本、CLI 用户可见字符串和布局元数据
不再使用“道心”“内景”“现世”作为正式名称；通过限定路径的文本搜索和
Markdown、skill 一致性检查证明。README 与历史 idea 中的允许用法不计为失败。

### I-AC02: 三重世界和文档契约名称保持一致

正式界面继续使用 Ideal World（理想世界）、Inner World（主体世界）、Outer
World（现实世界）和三重世界设计哲学，并分别以理想契约、主体实现契约、现实
部署契约指代 `Idea.md`、`Implementation.md`、`Deployment.md`；通过文档与
CLI contract 测试及针对性输出断言证明。

### I-AC03: 行为与兼容性保持不变

目录布局、公开字段、revision 级联和 lifecycle 行为不变，仓库完整 `pnpm check`
通过，并由 Silvermoon worktree、staged 与最终 commit 检查验证候选快照。
