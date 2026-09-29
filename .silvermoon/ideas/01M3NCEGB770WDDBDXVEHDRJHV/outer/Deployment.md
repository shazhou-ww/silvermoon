# Deployment

## Steps

### D-S01: 发布明确授权的 Silvermoon 版本

在实现获得验收且用户明确授权版本后，按照受保护 npm 发布流程从
`origin/main` 可达提交创建不可变 tag，并通过 GitHub Actions trusted
publishing 发布包含新整备行为的软件包。

### D-S02: 在干净消费者仓库验证 npm 整备

从注册表安装目标版本，在隔离的 npm、pnpm、Yarn、Bun 与 workspace-root
fixtures 中运行实际 CLI。验证缺失或错误 devDependency 会阻塞，报告的命令
修复顶层 manifest 后，canonical skill 可从 project-local package 注册，并能
继续进入仓库或 idea 层。

### D-S03: 验证非 npm 与自举场景

在不含顶层 `package.json` 的干净 Git 仓库运行同一已发布 CLI，证明不会提示
npm 安装；从发布提交的 Silvermoon source checkout 运行 CLI，证明无需自依赖
即可通过项目整备。保存命令输出、文件快照和 Git 状态证据。

## Acceptance criteria

### D-AC01: 已发布 npm 项目获得阻塞且可执行的版本对齐指令

注册表版本在顶层 npm manifest 缺少、错放或错配
`devDependencies.silvermoon: "^<运行时版本>"` 时返回
`project-setup-required`，并针对 fixture 的 package manager/workspace 生成
正确命令；执行修复并注册 skill 后重新观察能越过项目层。通过真实 CLI 输出、
manifest/lockfile diff 和后续 observation 证明。

### D-AC02: 安装来源、skill 与运行版本保持一致

修复后的消费者项目从 project-local Silvermoon package 注册 canonical skill，
该 skill 与已发布运行版本内容一致；全新安装后无需全局 Silvermoon 即可重现
同一结果。通过 package resolution、skill digest、CLI version 和 clean-clone
复验结果证明。

### D-AC03: 非 npm 项目不承担 npm 整备成本

没有顶层 `package.json` 的 Git 仓库不出现 package manager、devDependency、
lockfile 或 `node_modules` problem/instruction，仍可通过现有配置和 skill
步骤完成 adoption。通过注册表安装的隔离非 Node fixture 及前后文件树证明。

### D-AC04: Silvermoon source checkout 保持可开发

发布提交的 Silvermoon 仓库不会被要求在自身
`devDependencies` 中声明 Silvermoon，source checkout 的 `whats-next`、
`create-idea` 和各类 `check` 保持可用。通过干净 clone、冻结依赖安装和实际
命令输出证明。
