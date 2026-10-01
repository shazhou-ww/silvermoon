# Ledger

## Ideal World preparation

用户要求在 Ideal World 补全关键技术设计，技术方案独立成文并由 Idea.md
引用，重点审阅事件类型，同时记录其他重要技术选择。

- 配套设计：[Technical-design.md](./outer/inner/ideal/Technical-design.md)，
  由 [Idea.md](./outer/inner/ideal/Idea.md) 引用并共同计入 ideal revision。
- 已明确的语义：原 status.yaml 状态推演不变；只读查询使用实际世界
  revision，不自动追加观察，也不以观察未归档为由新增导航门槛。
- 用户后续明确：持久 event 必须完整、确定性改变旧 status 事实投影；
  重复输入不追加无操作事件。已撤销纯观察 E-04，并收紧元数据和决定撤回。
- 用户明确 append-only 只保护已提交并合入 main 的事件；本地未集成候选
  可同步后重审、去重和重新编号。并发不自动合并，采用自增序与乐观锁方向。
- 待审阅设计：九种有效状态迭代、准确决定与更正、受控本地后缀修订、
  primary 基线及集成主线校验、whats-next/skill 恢复指引、schema 切换与
  一次性迁移；详见 T-01 至 T-10。旧 DAG/所有父日志并集方案已撤销。
- 本轮仅补全理想设计。没有修改 schema、运行时或迁移现有 idea，没有
  执行实施/部署用例，没有取得理想批准、实施验收或部署验收。

## Implementation

### Implementation steps

- [ ] **I-S01:** 待理想契约批准后细化实施步骤

### Implementation acceptance criteria

- [ ] **I-AC01:** 待理想契约批准后细化实施验收标准

## Deployment

### Deployment steps

- [ ] **D-S01:** 待主体世界验收后细化部署步骤

### Deployment acceptance criteria

- [ ] **D-AC01:** 待主体世界验收后细化部署验收标准
