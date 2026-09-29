# Ledger

## Implementation

### Implementation steps

- [ ] **I-S01:** 建立 inventory query 模型
- [ ] **I-S02:** 提取可查询的 idea metadata
- [ ] **I-S03:** 增加无 repository readiness gate 的本地观察
- [ ] **I-S04:** 接入 CLI、API 与纯查询 renderer
- [ ] **I-S05:** 更新操作指南与自动化证据

### Implementation acceptance criteria

- [ ] **I-AC01:** 默认查询准确列出 active ideas
- [ ] **I-AC02:** 过滤、排序与 limit 可预测组合
- [ ] **I-AC03:** 无效参数在 repository 访问前失败
- [ ] **I-AC04:** inventory 不受 repository hygiene 与同步阻塞
- [ ] **I-AC05:** 纯查询输出完整且不伪造
- [ ] **I-AC06:** 不可信项目或 layout 显式失败
- [ ] **I-AC07:** 既有命令与文档保持一致

## Deployment

### Deployment steps

- [ ] **D-S01:** 发布明确授权的 Silvermoon 版本
- [ ] **D-S02:** 在真实消费者仓库验证 inventory 查询
- [ ] **D-S03:** 验证离线与非整备 repository 边界

### Deployment acceptance criteria

- [ ] **D-AC01:** npm 安装包公开可用 list-ideas
- [ ] **D-AC02:** 已发布查询符合默认与组合语义
- [ ] **D-AC03:** repository 未整备不阻止本地 inventory
- [ ] **D-AC04:** 无效输入与不可信数据不会伪装成功
- [ ] **D-AC05:** 既有工作流在已发布版本中不回归
