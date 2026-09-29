# Render Active ideas as a Markdown table

## Intent

让 `whats-next` 默认人类可读输出中的 Active ideas 部分采用与
`list-ideas` 一致的 Markdown 表格呈现模式，使 idea 清单更紧凑、易读且便于选择。

## Context

`list-ideas` 已使用 summary、计数和 Markdown 表格展示 idea inventory；
`whats-next` 的 Active ideas 区域仍采用较松散的逐项呈现方式。两种命令展示
idea 列表时格式不一致，也不便快速比较候选项。

## Desired outcome

- `whats-next` 的 Active ideas 区域以 Markdown 表格展示候选 idea，并延续
  `list-ideas` 的表格风格与单元格转义行为。
- 表格包含当前候选数据可用的 ID、Alias 和 State 列；Active ideas 为空时仍有
  清楚的空状态提示。
- 现有 summary、active idea 计数、选择提示、JSON response 和选择语义保持不变。

## Scope

### In scope

- 调整 `whats-next` 默认人类可读输出中的 Active ideas 呈现。
- 复用或遵循 `list-ideas` 的 Markdown 表格、字段转义和空列表提示模式。
- 添加回归测试，覆盖有候选项、空列表、表格字段和特殊字符处理。

### Out of scope

- 改变 active idea 的筛选、排序、计数或选择逻辑。
- 为 `whats-next` 增加当前 observation 未提供的 idea 元数据。
- 改变 JSON 输出结构或 `list-ideas` 的渲染行为。

## Constraints

- 只影响 `whats-next` 的人类可读呈现；保持统一 command report 的其他 projection
  和 JSON 行为兼容。
- Markdown 表格单元格必须安全转义，不能因 idea 字段中的竖线或换行破坏表格结构。
