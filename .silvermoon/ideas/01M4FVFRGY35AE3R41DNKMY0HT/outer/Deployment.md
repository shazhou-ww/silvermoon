# Deployment

## Steps

### D-S01: 验证已安装多语言输出

在安装制品上执行代表性的英文与中文 `what's next` 场景，确认模板模块在构建和打包后可用。

### D-S02: 通过正常发布流程交付

使用既有发布检查交付重构后的 CLI，不增加独立运行服务或迁移步骤。

## Acceptance criteria

### D-AC01: 安装制品输出正确

安装制品测试证明代表性 `what's next` 场景在英文与中文下均产生预期文本。

### D-AC02: 发布检查保持通过

发布级检查和制品验证通过，并能从发布 commit 定位到可按语言审阅的模板源码。

## Evidence

- `D-S01` 的安装制品 smoke test 已通过：从 checkout 打包并安装
  `silvermoon@0.4.0` tarball 后，英文与中文 `what's next` 场景各通过
  6 项模板断言。
- `D-S02` 尚未完成。不可变标签 `npm/silvermoon/v0.4.0` 指向
  [9501f2f4887c](https://github.com/shazhou-ww/silvermoon/commit/9501f2f4887c360f0902f559e7c6456ffe72b43d)；
  [trusted-publishing run 37915490515](https://github.com/shazhou-ww/silvermoon/actions/runs/37915490515)
  在制品构建与 npm publish 前的 repository snapshot check 失败。截至
  2026-10-09，npm `latest` 仍为 `0.3.0`。
- [8c54d4fbe826](https://github.com/shazhou-ww/silvermoon/commit/8c54d4fbe826f56db37a006bf302181ff32fdb9f)
  已修复后续 tag checkout 的 canonical `origin` URL；该修复没有移动、
  删除或重建现有 `0.4.0` 标签。
- 不移动标签的恢复入口也已验证：针对现有 tag 的 `workflow_dispatch`
  被 GitHub 以 HTTP 422 拒绝；[deployment 6958854727](https://api.github.com/repos/shazhou-ww/silvermoon/deployments/6958854727)
  正确绑定同一 tag 与 commit，但旧 tag 中没有对应 trigger，未创建
  workflow run，并已记录为 `failure`。
- 当前发布身份约束下没有可继续执行的安全恢复路径。GitHub
  [workflow rerun](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)
  会保留原事件的 `GITHUB_SHA` 与 `GITHUB_REF`；从其他 revision 触发后
  再 checkout 原 tag，则 npm provenance 会指向触发 revision，而不是原
  tag。按照 [SLSA build provenance](https://slsa.dev/spec/v1.2/build-provenance)
  的输入与 resolved dependency 语义，覆盖 provenance 环境以伪装原 tag
  不可接受。若仍发布 `0.4.0`，只能显式授权一个新的受保护 recovery
  revision 作为实际 source/provenance identity，并同步修改发布规则与
  验证器；在该授权出现前，`D-S02` 与 `D-AC02` 保持 blocked。
