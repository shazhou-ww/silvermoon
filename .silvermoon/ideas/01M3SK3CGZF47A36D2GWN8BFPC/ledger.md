# Ledger

## Implementation

### Implementation steps

- [x] **I-S01:** 实测 Copilot SDK 的运行与恢复边界
- [x] **I-S02:** 实现隔离的项目运行时协议
- [x] **I-S03:** 实现单实例 Agent 接口和 Copilot 适配器
- [x] **I-S04:** 接入本地交互事件并验证恢复
- [x] **I-S05:** 完成受控验收和使用指引

### Implementation acceptance criteria

- [x] **I-AC01:** 真实 Copilot 能力和限制有可重复证据
- [x] **I-AC02:** 项目版本独立解释流程
- [x] **I-AC03:** 单实例适配器安全复用会话
- [x] **I-AC04:** 全双工交互不会重放副作用
- [x] **I-AC05:** 交付的包可由调用方使用

## Deployment

### Deployment steps

- [ ] **D-S01:** 固定已验收候选与部署边界
- [ ] **D-S02:** 从独立调用方安装并验证项目版本边界
- [ ] **D-S03:** 验证独立调用方的真实 Copilot 交互与恢复边界
- [ ] **D-S04:** 核对证据、限制和恢复指引

### Deployment acceptance criteria

- [ ] **D-AC01:** 固定候选可由独立调用方安装和导入
- [ ] **D-AC02:** 安装后的项目版本保有解释权
- [ ] **D-AC03:** 真实 Agent 的外部交互可安全复用
- [ ] **D-AC04:** 已验证结果与不确定性有清晰交付边界
