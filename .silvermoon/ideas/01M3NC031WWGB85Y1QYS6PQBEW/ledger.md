# Ledger

## Implementation

### Implementation steps

- [ ] **I-S01:** 建立根级公开资产契约
- [ ] **I-S02:** 生成 commit 固定的 jsDelivr README
- [ ] **I-S03:** 构建并发布单一 tarball
- [ ] **I-S04:** 加强发布编排与外部核验
- [ ] **I-S05:** 覆盖发布合同并完成仓库验证

### Implementation acceptance criteria

- [ ] **I-AC01:** 公开资产路径一致且向后兼容
- [ ] **I-AC02:** 发布 README 只引用不可变资源
- [ ] **I-AC03:** 验证与发布使用同一 tarball
- [ ] **I-AC04:** 主分支发布信任边界保持不变
- [ ] **I-AC05:** 完整候选通过 release-grade 验证

## Deployment

### Deployment steps

- [ ] **D-S01:** 通过受保护标签发布明确授权的版本
- [ ] **D-S02:** 核对注册表与发布产物身份
- [ ] **D-S03:** 验证公开 README 与资产兼容性

### Deployment acceptance criteria

- [ ] **D-AC01:** 发布来源可追溯到受保护主分支
- [ ] **D-AC02:** 注册表提供经过验证的同一产物
- [ ] **D-AC03:** 公开 README 使用不可变 CDN 资源
- [ ] **D-AC04:** 历史资产 URL 保持可用
