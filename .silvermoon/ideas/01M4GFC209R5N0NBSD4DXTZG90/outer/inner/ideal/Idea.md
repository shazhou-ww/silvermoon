# 基于真实输出 review 全部 whats-next 场景

## 问题

仅对照 whats-next 模板源码逐项 review，难以看清设备、repository 和 lifecycle
状态组合后的完整输出，也容易遗漏 routing 分支或对实际文本作出错误推断。

## 结果

准备可复现的 Docker 环境，从设备整备开始运行少量连续链路，在每条链路的多个
状态 checkpoint 覆盖 Device、Project、Idea 三个 objective 的全部 check，并执行
全局 `silvermoon whats-next` 形成完整 review 语料。维护者基于语料集中 review，
并只依据明确结论更新实施状态。

## 边界

- 场景必须通过隔离环境中的真实 CLI 和项目状态产生，不直接调用模板或伪造输出。
- 每条链路只初始化一次并连续覆盖多个 case；仅为互斥或不可逆状态拆分支链。
- objective check 是 instruction case 的 canonical 覆盖单位；模板映射和无 check 的
  navigation/terminal 输出作为补充覆盖。

## 验收标准

- 自动化覆盖检查证明三个 objective 的每个 check 都恰有对应 checkpoint，补充输出
  也有可执行场景。
- 全新 Docker 环境可从设备整备开始完成全部链路，并产出可追溯的双语完整输出。
- 维护者完成整套语料 review 后无待处理项，相关修正通过 report 与 release 级验证。
