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
