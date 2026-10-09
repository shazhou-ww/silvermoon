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
- `D-S02` 的首次发布尝试使用不可变标签 `npm/silvermoon/v0.4.0`，该标签指向
  [9501f2f4887c](https://github.com/shazhou-ww/silvermoon/commit/9501f2f4887c360f0902f559e7c6456ffe72b43d)；
  [trusted-publishing run 37915490515](https://github.com/shazhou-ww/silvermoon/actions/runs/37915490515)
  在制品构建与 npm publish 前的 repository snapshot check 失败。截至
  该次失败结束时，npm `latest` 仍为 `0.3.0`。
- [8c54d4fbe826](https://github.com/shazhou-ww/silvermoon/commit/8c54d4fbe826f56db37a006bf302181ff32fdb9f)
  已修复后续 tag checkout 的 canonical `origin` URL；该修复没有移动、
  删除或重建现有 `0.4.0` 标签。
- 不移动标签的恢复入口也已验证：针对现有 tag 的 `workflow_dispatch`
  被 GitHub 以 HTTP 422 拒绝；[deployment 6958854727](https://api.github.com/repos/shazhou-ww/silvermoon/deployments/6958854727)
  正确绑定同一 tag 与 commit，但旧 tag 中没有对应 trigger，未创建
  workflow run，并已记录为 `failure`。
- 原 tag 无法直接安全恢复。GitHub
  [workflow rerun](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)
  会保留原事件的 `GITHUB_SHA` 与 `GITHUB_REF`；从其他 revision 触发后
  再 checkout 原 tag，则 npm provenance 会指向触发 revision，而不是原
  tag。按照 [SLSA build provenance](https://slsa.dev/spec/v1.2/build-provenance)
  的输入与 resolved dependency 语义，覆盖 provenance 环境以伪装原 tag
  不可接受。
- `D-S02` 与 `D-AC02` 已通过真实 recovery identity 完成。受保护标签
  `npm/silvermoon-recovery/v0.4.0` 指向
  [191e74387e25](https://github.com/shazhou-ww/silvermoon/commit/191e74387e2566645f4fdaf74e1c20ec38ad0d02)；
  [trusted-publishing run 37923552823](https://github.com/shazhou-ww/silvermoon/actions/runs/37923552823)
  的 build、全部测试、package check、installed-package E2E、publish 与
  post-publication verifier 均成功，并输出 `VERIFY_NPM_RELEASE_OK`。
  npm `latest` 现为 `silvermoon@0.4.0`，registry `gitHead` 为同一 recovery
  commit，provenance invocation 绑定该 workflow run；对应
  [GitHub Release](https://github.com/shazhou-ww/silvermoon/releases/tag/npm/silvermoon-recovery/v0.4.0)
  已发布。原 `npm/silvermoon/v0.4.0` 标签仍保持原 commit，未移动、删除或
  重建。
