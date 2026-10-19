# 暴露 Objective 的准确停留位置

## 问题

Objective observation 目前能给出 current level 和 problems，却没有正式暴露首个失败
check；部分业务 adapter 还把多个动态事实压入 description，统一报告无法可靠解释
“停在哪里、为什么停止”。

## 结果

建立稳定的位置契约，完整表示 Objective/owner、level、首个失败 check 和该 check
返回的有序 Problem 集；Problem 只携带稳定 ID 与结构化动态 parameters。

## 边界

- 一个失败 check 可返回多个 problems，位置契约不得假设一一对应。
- prerequisite 中的失败保留实际 owner Objective，不冒充目标 Objective 的本地 level。
- checks 不返回最终本地化报告文本；静态知识仍由 Reference Pages 提供。

## 验收标准

- 每次非 terminal probe 都能准确指出 owner、level、failing check 与完整 problems。
- 多 check level、prerequisite 和多 Problem 结果都有类型安全的契约测试。
- 既有 bundled Objective adapters 不再依赖拼接 description 才能识别动态问题事实。
