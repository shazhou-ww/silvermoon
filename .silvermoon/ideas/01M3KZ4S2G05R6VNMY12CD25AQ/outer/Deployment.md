# Deployment

## Steps

### D-S01: 发布稳定的 create-idea 契约

将已接受的实现和本 Deployment 契约发布至 configured primary，记录精确
primary commit 与 deployment revision。后续验真只观察已发布候选，不在
验真阶段修改内层 world 或实现交付物。

### D-S02: 验证安装包的三类输出路径

从已发布源码打包并安装到隔离消费者，构造项目未整备、本地仓库未整备及
创建成功/失败场景。验证默认文本与 JSON、无网络 create、未知工作保护和
语言术语；同时 smoke test `whats-next` 保持既有同步行为。

## Acceptance criteria

### D-AC01: primary 上的候选可验证

`silvermoon check --remote --json` 对记录的 primary commit 返回
`project-ready` 且没有 problems；指定本 idea 的 `whats-next --json`
返回 deploying 状态及与已发布 Deployment 契约一致的 revision。

### D-AC02: 安装后的 create-idea 遵守收紧契约

installed-package e2e 证明：项目问题优先且不触碰 Git/remote；dirty 或错误
branch/upstream 只报告本地阻塞；clean primary branch/upstream 在不同
ahead/behind 关系和不可用网络下仍能创建；成功与故障注入输出符合已批准的
JSON 和双语文本契约。测试还证明未发生 fetch，未知文件未被修改或删除。

### D-AC03: whats-next 行为没有回归

同一安装包上的 navigation 和 selected-idea smoke test 证明
`whats-next` 仍按既有契约 fetch、判断 synchronization、展示适用候选并在
远端或本地问题出现时给出原有 remediation；记录命令、结果与版本。
