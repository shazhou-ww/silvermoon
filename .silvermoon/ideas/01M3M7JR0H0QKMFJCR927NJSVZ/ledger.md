# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 统一正式文档与 skill 的世界术语
- [x] **I-S02:** 更新 CLI 与用户可见元数据
- [x] **I-S03:** 调整契约测试并验证术语边界

### Implementation acceptance criteria

- [x] **I-AC01:** 正式界面不再使用仙侠别名
- [x] **I-AC02:** 三重世界和文档契约名称保持一致
- [x] **I-AC03:** 行为与兼容性保持不变

Evidence: targeted terminology tests and scoped alias searches passed;
`pnpm check` passed with 74 integration tests, 2 skips, package smoke, e2e,
and skill consistency checks.

## Deployment

### Deployment steps

- [ ] **D-S01:** 验证远端主分支的术语边界
- [ ] **D-S02:** 验证安装包中的 CLI 与 skill

### Deployment acceptance criteria

- [ ] **D-AC01:** Primary 快照满足正式术语契约
- [ ] **D-AC02:** 打包安装后的行为保持一致
