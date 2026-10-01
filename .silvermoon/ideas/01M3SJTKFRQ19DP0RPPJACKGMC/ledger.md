# Ledger

## Ideal World preparation

用户要求在 Ideal World 补全关键技术设计，技术方案独立成文并由 Idea.md
引用，重点审阅事件类型，同时记录其他重要技术选择。

- 配套设计：[Technical-design.md](./outer/inner/ideal/Technical-design.md)，
  由 [Idea.md](./outer/inner/ideal/Idea.md) 引用并共同计入 ideal revision。
- 用户要求以 TypeScript 具体定义事件和 reducer，已补充
  [Event-state-model.ts](./outer/inner/ideal/Event-state-model.ts)，仅为理想
  设计模型，当前包含七类事件、非空转换、自增序检查与旧五态推演。
- 按用户审阅反馈，事件类型改为显式 discriminated union，每个分支并列
  展示 type 和 payload；移除 EventPayloads 映射间接层，归约行为不变。
- 已明确的语义：原 status.yaml 状态推演不变；只读查询使用实际世界
  revision，不自动追加观察，也不以观察未归档为由新增导航门槛。
- 用户后续明确：持久 event 必须完整、确定性改变旧 status 事实投影；
  重复输入不追加无操作事件。已撤销纯观察 E-04，并收紧元数据变更。
- 用户明确 append-only 只保护已提交并合入 main 的事件；本地未集成候选
  可同步后重审、去重和重新编号。并发不自动合并，采用自增序与乐观锁方向。
- 用户补充 check 规则：仅 base 完整归约为 ok: true 时强制 append-only；
  base 明确归约失败时允许改旧事件修复，完整候选须归约成功。修复成功后
  恢复前缀保护，旧失败不能永久阻塞；基线不可用不冒充归约失败。
- 用户进一步要求业务模型极简：删除 created，metadata 拆为 alias/language
  更新，删除审计字段与 repo commit 依赖。明确选择迁移用普通状态变更事件，
  删除 imported；归约顺序不冒充历史顺序，迁移与写入校验留在工具层。
- 当前方案取消 Envelope、eventId、逐行版本、前序 hash 及来源索引。
  日志摘要仍用于外层乐观锁请求，不存入事件。身份来自目录，空日志合法。
- 用户确认不引入内容不变时独立撤回批准/验收的能力，已删除
  decision.retracted、DecisionField、expectedRevision 及对应归约分支。
  实际业务变化修改对应世界内容，让 revision 自然级联失效并重新审阅。
- 待审阅设计：七种有效状态迭代、准确决定与更正、受控本地后缀修订、
  primary 基线及集成主线校验、whats-next/skill 恢复指引、schema 切换与
  一次性迁移；详见 T-01 至 T-10。旧 DAG/所有父日志并集方案已撤销。
- 前述设计讨论未单独作为批准。用户随后明确要求“记录下来后，我 approve
  idea，可以推进实现”，批准已绑定包含修复规则的准确 ideal revision
  `519ebd3b273c99f8c4f1d40b8effb163df1763e2`。
  状态事实独立提交 `7c64dc483e0ed12969c934aa4573f615e9e104de` 已同步 primary，
  重新观察进入 implementing。没有实施验收或部署验收。

## Implementation

### Implementation steps

- [ ] **I-S01:** 实现最小事件核心与严格 schema
- [ ] **I-S02:** 接入 v2 项目读取与创建
- [ ] **I-S03:** 实现基线检查与修复例外
- [ ] **I-S04:** 接入受控追加、修订和恢复指引
- [ ] **I-S05:** 实现独立的一次性迁移
- [ ] **I-S06:** 完成文档、skill、集成与交付证明

### Implementation acceptance criteria

- [ ] **I-AC01:** 七种事件完整且克制
- [ ] **I-AC02:** 旧事实与五态行为保持
- [ ] **I-AC03:** 检查准确区分追加、修复和不可用
- [ ] **I-AC04:** 并发写入和修订安全
- [ ] **I-AC05:** 迁移显式、完整、可恢复
- [ ] **I-AC06:** 全部入口与发布级检查通过

已制定实施契约及匹配稳定 ID；上述功能仍未实现，尚无交付证据。
当前仓库不自动迁移，不将 Ideal World 演示模型的检查当作生产实现验收。

## Deployment

### Deployment steps

- [ ] **D-S01:** 待主体世界验收后细化部署步骤

### Deployment acceptance criteria

- [ ] **D-AC01:** 待主体世界验收后细化部署验收标准
