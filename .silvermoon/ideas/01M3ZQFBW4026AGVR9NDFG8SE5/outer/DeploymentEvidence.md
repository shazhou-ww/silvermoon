# 部署验证证据

本文件服务于 [Deployment](./Deployment.md)，记录现实世界验证结果，不构成新的
部署契约，不授权 npm 发布。

## 候选与环境

待稳定 Deployment 契约同步 primary 后填写准确源码提交、deploymentRevision、
操作系统、Node、pnpm 与 npm 版本。

## 制品与安装

待执行 D-S01 与 D-S02 后记录 tarball 身份、严格文件清单及隔离安装结果。

## 真实 CLI 与调用方

待执行 D-S03 与 D-S04 后记录 npm exec/npx shim、公开 API、Agent 子路径、trace
及 event 命令表面结果。

## 限制

本部署只验证本地构建制品和真实安装态行为，不发布 npm、不创建 release tag，
不声明 registry、provenance 或生产环境已更新。
