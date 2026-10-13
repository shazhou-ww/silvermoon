# Deployment

## Steps

### D-S01: 整备契约候选运行时

用 `pnpm setup:dev` 将已接受的契约实现 checkout 链接为设备全局运行时，确认 personal skill 链接仍指向 canonical skill，不发布 npm 包或宣称 OR/OPS 已具备生产运行能力。

### D-S02: 验证现有 CLI 兼容边界

通过全局 `silvermoon` 在实际仓库及受控验证对象上观察导航结果，证明 OG 契约演进未改变 `whats-next` 的现实行为；不启动 OR/OPS 调度，不创建或推断未授权的接受事实。

## Acceptance criteria

### D-AC01: 全局运行时指向本仓库

保存 setup 结果和运行时、skill 链接检查证据，证明运行的是准确已接受 checkout，而非发布包或其他 checkout。

### D-AC02: 现实导航保持兼容

记录实际 CLI 调用与结果，证明对象选择、阻塞指导及重新观察仍可用；类型新增不会自动执行 skill、启动组合调度或记录接受，遇到人工或外部等待仍能交接。
