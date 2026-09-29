# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 分离输出语言与内容语言
- [x] **I-S02:** 扩展 CLI 与 command contract
- [x] **I-S03:** 贯通 whats-next 全部输出路径
- [x] **I-S04:** 贯通 check 的全部 target 与失败路径
- [x] **I-S05:** 更新 skill、文档与回归覆盖

### Implementation acceptance criteria

- [x] **I-AC01:** 支持语言规范化且严格
- [x] **I-AC02:** whats-next override 覆盖显示但不覆盖内容偏好
- [x] **I-AC03:** check override 覆盖所有验证表面
- [x] **I-AC04:** 调用意图与重试语言可观察
- [x] **I-AC05:** create-idea 与持久化语言保持兼容
- [x] **I-AC06:** 文档、skill 与发布级检查一致

## Deployment

### Deployment steps

- [x] **D-S01:** 发布明确授权的 Silvermoon 版本
- [x] **D-S02:** 从已发布包验证双语 override
- [x] **D-S03:** 验证持久化与错误边界

### Deployment acceptance criteria

- [x] **D-AC01:** 已发布命令可稳定选择英文或中文输出
- [x] **D-AC02:** override 不改变项目或 lifecycle 状态
- [x] **D-AC03:** unsupported language 快速且安全地失败
- [x] **D-AC04:** create-idea 的既有多语言能力不回归
