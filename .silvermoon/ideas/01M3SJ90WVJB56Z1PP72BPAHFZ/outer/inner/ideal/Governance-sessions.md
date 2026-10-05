# 设备治理 session 与设备控制项目

本文件描述目标设计，不代表设备级治理或 Agent session 持久化已经实现。

## 设备控制项目承载设备治理

每台设备有一个设备控制项目，默认 Git repository 位于
`$HOME/.silvermoon/device-hq/`；`$HOME/.silvermoon/` 本身只是设备级数据根，
可容纳非 Git 管理的 cache 等可变数据。设备控制项目以本机 Git repository 表达
设备本身。该项目也有 Silvermoon 的 Ideal、Implementation、Deployment 三个
世界：Ideal 定义设备希望达到的状态，Implementation 包含维护脚本与程序，
Deployment 的现实对象就是这台设备。

```text
$HOME/.silvermoon/
├── device-hq/                      # device-control Git repository
│   ├── .silvermoon/ideas/<id>/events/
│   └── scripts/                    # versioned device-maintenance implementation
└── cache/                          # mutable data; not part of the Git repository
```

设备控制项目承载该设备唯一、长期存在的 governance Agent session。它负责设备
状态维护，并代表设备处理各项目的接入、clone、Silvermoon onboarding、idea 创建
和跨项目调度；不为每个 managed project 创建额外的长期 governance session。
`device` route 选择这一治理 session；`project` route 提供它当前操作的 repository
上下文，不意味着另有 project thread。每个 idea 仍有独立的 lifecycle events、
worktree 和执行 session。

治理 session 对设备的维护结论应落实为设备控制项目的实现：需要持续、可审阅或
可重复的维护动作时，创建/推进相应 `device-idea`，在其 Inner World 中实现脚本或
小程序，再于 Outer World 验证设备效果。临时的只读观察不必因此建立永久事件流。

设备 HQ 默认使用逻辑设备专属的 private remote，保存可移植治理契约、idea history、
恢复实现、期望 binary/skill release 和无凭据项目登记清单；remote 不等于本机
Outer World，也不保存秘密或易失运行态。初次创建从最小本地 Silvermoon project
scaffold 开始，恢复时从准确 remote revision clone；两者都不克隆 Silvermoon 源码。
managed project 的 lifecycle facts 留在该项目自己的 Silvermoon idea streams。
通过 daemon `--root` 启动隔离实例时，
必须使用该 root 下隔离的设备控制项目，不接触真实 `$HOME/.silvermoon`。

## Governance session 持久化与恢复

治理对话由 Agent SDK 的持久 session 保存，不另建治理 event stream，也不把完整
对话镜像进设备控制项目或 managed project 的 Git history。Agent session 是长期
协作上下文；Silvermoon idea events 仍是项目状态和生命周期的权威事实，两者不可
互相替代。

upstream 对未确认输入负责可靠保留，并在断线或结果不确定时用相同 `requestId`
重新投递。daemon 只持久化恢复所需的轻量元数据：设备治理 session binding、
`requestId` 去重状态和 delivery receipt；不保留一份完整治理消息日志。receipt
须将 `requestId` 绑定到 route 与规范请求摘要；相同 ID 对应不同请求时显式冲突，
不得覆盖旧 receipt。相同请求不得创建重复的 Agent turn 或副作用。

daemon 先持久化 `pending` receipt，再将原 requestId 作为 metadata/idempotency key
交给已绑定的持久 Agent session；只有可恢复的 session handoff 和 receipt 均持久后，
才向 upstream 返回接收确认。发送结果不确定时，先按 `requestId` 检查 SDK session
与本地 receipt；若无法证明是否已送达，保持 `unknown`，由 upstream 保留请求并重试，
不盲目创建新 session 或重发可能重复执行的 turn。Agent transcript 不能
单独证明设备操作成功；clone、配置变化、脚本运行或磁盘维护须按其实际目标观察
结果，并把明确结果返回 upstream。

session 丢失、SDK 无法恢复、设备控制项目不可用或本地 receipt 与 Agent transcript
不一致时，显式报告并停止自动副作用。是否允许受控地新建替代 session、如何形成
上下文交接摘要，以及旧 session 未确认操作的归属仍待确定。

整机恢复不尝试从 Git 复原 Agent session、receipt 或在途执行。新物理设备接管同一
逻辑 device identity 前须撤销或 fence 旧 owner，并从外部秘密来源恢复凭据；随后
重建 managed checkouts、session bindings 和消费位置，再根据真实项目 facts 协调
所有 `unknown` 操作。同一逻辑设备不能同时有两个 active daemon owner。

## 持久化边界

- 不创建 device/project governance `events/`、governance HEAD、segment、
  projection checkpoint 或治理事件 replay。
- daemon root 只保存 registry、session binding、requestId 去重与投递回执等
  必需运行状态；其具体最小 schema 尚待定义。
- 设备控制项目及 managed projects 中的每个 idea 继续使用已交付的 V2 分段
  `events/`。每段上限 1000 条，HEAD/cursor 与 digest 遵循所属 Git repository
  的 object format；不因 governance session 的长期存在改变 idea 事件契约。
- device governance 直接使用 Agent runtime session，不调用项目 `event replay`
  CLI，也不把 Agent transcript 作为 Silvermoon event stream。

## 尚待讨论

1. Agent SDK 持久 session 的恢复、历史查询、requestId 关联和发送结果未知语义。
2. upstream 保留未确认 request 的时长、ack 阶段及重复投递协议。
3. 轻量本地 receipt 的最小状态机、原子写入和保留期限；不得演变成完整治理日志。
4. private remote 的创建/接入、可信 bootstrap、secret recovery、owner fencing、
   镜像与定期恢复演练的具体接口。
5. 自定义 `--root` 下隔离项目的创建方式及测试如何完全避免真实设备副作用。
6. device governance、project 上下文和 idea 执行之间的权限边界；尤其是 clone、
   shell 脚本、删除/清理及磁盘维护的授权与结果核验。
7. governance session 的上下文预算、受控换代及未完成操作交接。
