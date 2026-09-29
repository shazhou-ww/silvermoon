# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 建立根级公开资产契约
- [x] **I-S02:** 生成 commit 固定的 jsDelivr README
- [ ] **I-S03:** 构建并发布单一 tarball
- [ ] **I-S04:** 加强发布编排与外部核验
- [ ] **I-S05:** 覆盖发布合同并完成仓库验证

### Implementation acceptance criteria

- [x] **I-AC01:** 公开资产路径一致且向后兼容
- [x] **I-AC02:** 发布 README 只引用不可变资源
- [ ] **I-AC03:** 验证与发布使用同一 tarball
- [ ] **I-AC04:** 主分支发布信任边界保持不变
- [ ] **I-AC05:** 完整候选通过 release-grade 验证

### 实现证据

- 2026-09-29：canonical 头像已加入 `assets/silvermoon-avatar.svg`，历史
  `docs/assets/silvermoon-avatar.svg` 保留为普通文件兼容副本；两者 SHA-256
  均为 `189F8EC740EB8469F96360E5E38121ED4A15C250D39747020EA668B818C5EF33`。
  `node --test "test/contract/assets.test.js"`、`pnpm pack:check` 与
  `pnpm test:e2e` 通过，证明 SVG 安全性与明暗主题对比度、双路径字节一致性、
  package allowlist 和安装后内容一致性。
- 2026-09-29：两份仓库 README 的主视觉与头像均改用根级资产的 GitHub-backed
  jsDelivr `@main` URL；npm README generator 将本仓库 jsDelivr 与旧
  raw GitHub `main` 引用固定到指定完整提交，并拒绝缺失 ref、`HEAD`、其他
  分支或标签、错误提交、相对图片及可移动 GitHub 文件 URL。聚焦的 18 项单元、
  集成与契约测试通过，真实 README 的生成结果仅引用指定提交，且源文件在生成
  前后保持字节不变。

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
