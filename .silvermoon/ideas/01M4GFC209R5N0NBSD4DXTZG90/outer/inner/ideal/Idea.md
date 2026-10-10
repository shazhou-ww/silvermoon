# Review 全部 whats-next templates

## 问题

whats-next catalog 包含成对的 en-US/zh-CN 模板，需要逐项人工 review 文案语义、
命令边界、返回形状和两种 locale 的一致性。目前只有四个模板 ID 已明确完成
review，其余状态不能从代码修改或测试通过中推断。

## 结果

以 [review-status.md](./review-status.md) 作为完整 catalog 的 review 清单，逐项完成
剩余模板 review，并只依据人工明确结论更新状态，最终得到无遗漏的已 review
catalog。每一项按照 [review-method.md](./review-method.md) 的协作方法处理。

## 边界

- 一个模板 ID 的 review 同时覆盖对应的 en-US 与 zh-CN 文件。
- 每次只 review 一个 template ID，不批量推断其他模板的结论。
- review 状态是人工事实；代码已修改、测试通过或 Agent 判断均不能自动标记完成。
- 不借 review 工作改变 canonical template ID、机器字段、事件类型或 schema。

## 验收标准

- `review-status.md` 精确覆盖 catalog 中除 locale `index.ts` 外的全部模板 ID。
- `content-language`、`detached-head`、`event-history-invalid`、`head-missing`
  保持 `reviewed`，其他模板在获得明确 review 前保持 `pending`。
- 所有模板完成 review 后，清单无 `pending`，且相关修正通过模板与 report 验证。
