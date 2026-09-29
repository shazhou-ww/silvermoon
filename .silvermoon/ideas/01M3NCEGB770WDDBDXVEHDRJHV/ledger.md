# Ledger

## Implementation

### Implementation steps

- [ ] **I-S01:** 识别根级 npm 项目
- [ ] **I-S02:** 强制运行时对齐的 devDependency
- [ ] **I-S03:** 生成包管理器感知的修复指令
- [ ] **I-S04:** 对齐 skill 注册与 snapshot 行为
- [ ] **I-S05:** 更新公共契约与回归覆盖

### Implementation acceptance criteria

- [ ] **I-AC01:** npm 项目分类只取决于根 manifest
- [ ] **I-AC02:** devDependency 契约阻止未整备 npm 项目
- [ ] **I-AC03:** remediation 与项目包管理器和 workspace 一致
- [ ] **I-AC04:** npm skill 来源可复现且诊断保持只读
- [ ] **I-AC05:** snapshot 与跨生态行为不回归
- [ ] **I-AC06:** 完整候选通过发布级验证

## Deployment

### Deployment steps

- [ ] **D-S01:** 发布明确授权的 Silvermoon 版本
- [ ] **D-S02:** 在干净消费者仓库验证 npm 整备
- [ ] **D-S03:** 验证非 npm 与自举场景

### Deployment acceptance criteria

- [ ] **D-AC01:** 已发布 npm 项目获得阻塞且可执行的版本对齐指令
- [ ] **D-AC02:** 安装来源、skill 与运行版本保持一致
- [ ] **D-AC03:** 非 npm 项目不承担 npm 整备成本
- [ ] **D-AC04:** Silvermoon source checkout 保持可开发
