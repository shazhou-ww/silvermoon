# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 按有效内容语言生成脚手架
- [x] **I-S02:** 在 lifecycle next step 中声明内容语言
- [x] **I-S03:** 收紧 canonical skill 与操作文档
- [x] **I-S04:** 建立跨表面的语言回归覆盖

### Implementation acceptance criteria

- [x] **I-AC01:** 中文 idea 不再生成英文自然语言占位
- [x] **I-AC02:** 非内置内容语言不会被静默误表示
- [x] **I-AC03:** whats-next 实时给出正确内容语言
- [x] **I-AC04:** skill、文档与实现保持一致

## Deployment

### Deployment steps

- [x] **D-S01:** 发布仓库部署契约
- [x] **D-S02:** 验证已发布的 primary snapshot
- [x] **D-S03:** 验证真实内容语言行为

### Deployment acceptance criteria

- [x] **D-AC01:** Primary 包含完整部署候选
- [x] **D-AC02:** 内容语言契约在真实 CLI 中成立
- [x] **D-AC03:** Release-grade 验证保持通过
