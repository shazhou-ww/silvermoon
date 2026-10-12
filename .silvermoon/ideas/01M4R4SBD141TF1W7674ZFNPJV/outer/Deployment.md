# Deployment

## Steps

### D-S01: 整备开发运行时

用 `pnpm setup:dev` 将已接受实现的 checkout 链接为设备全局运行时，确认 personal skill 链接仍指向 canonical skill，不发布 npm 包。

### D-S02: 验证真实 CLI 导航

通过全局 `silvermoon` 在实际仓库及受控验证对象上观察导航结果，验证新抽象在设备运行时可用，不创建或推断未授权的接受事实。

## Acceptance criteria

### D-AC01: 全局运行时指向本仓库

保存 setup 结果和运行时、skill 链接检查证据，证明运行的是本 checkout，而非发布包或其他 checkout。

### D-AC02: 现实导航结果可用

记录实际 CLI 调用与结果，证明对象选择、阻塞指导及重新观察可用；导航不改写契约或自动记录接受，遇到人工或外部等待能够交接。
