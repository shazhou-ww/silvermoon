# Ledger

## Implementation

### Implementation steps

- [ ] **I-S01:** 补齐可归因的测量边界
- [ ] **I-S02:** 合并 repository observation 与 readiness
- [ ] **I-S03:** 缩小 inventory metadata 读取
- [ ] **I-S04:** 直接验证 immutable check snapshot
- [ ] **I-S05:** 证明结果等价与性能改善

### Implementation acceptance criteria

- [ ] **I-AC01:** Trace 覆盖真实命令工作且保持安全
- [ ] **I-AC02:** Inventory 只读取必要标题
- [ ] **I-AC03:** Creation 与 navigation 合并本地 Git readiness
- [ ] **I-AC04:** Check 不再完整物化 repository
- [ ] **I-AC05:** 相对性能目标通过
- [ ] **I-AC06:** 完整兼容性验证通过

## Deployment

### Deployment steps

- [ ] **D-S01:** 发布并锁定验收候选
- [ ] **D-S02:** 在干净 clone 重放 trace benchmark

### Deployment acceptance criteria

- [ ] **D-AC01:** Primary 候选有效且可追溯
- [ ] **D-AC02:** 干净环境复现确定性优化
- [ ] **D-AC03:** 真实命令行为保持兼容

## Preparation evidence

- 2026-09-30：在一次性干净 clone 上使用 Node v24.11.1、
  Git 2.55.0.windows.3 和 pnpm 11.22.0 采集 90 份诊断 trace；
  最终基线只使用同一 fixture commit 上的 45 份 warm 后样本。
- 基线 fixture 为 32 个 ideas、2 个 active ideas，CLI `src` tree 为
  `8954b0a82b0e6421415075f646011ea06e7e91e6`。原始 trace 保存在
  session artifact 中且未提交；可复现方法、全部最终中位数和建议记录在
  `outer/inner/ideal/performance-research.md`。
