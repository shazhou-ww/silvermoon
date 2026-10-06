# `event replay` 使用边界

## 定位

`event replay` 是 Silvermoon 面向开发、诊断、历史验证和受控人工恢复的命令，
不是 daemon 与项目运行时之间的生产通信协议。Silvermoon 内部可以复用其背后的
事件归约和投影能力，但生产组件不应通过启动 `event replay` CLI 子进程获得状态。

daemon 的生产路径不得调用 `event replay`。发现此类调用需求时，应先识别真正
缺少的能力，而不是把调试命令固化为跨进程依赖。

重构后的生产实现还不得通过 `ProjectRuntime` 启动 managed repository 自带的
Silvermoon CLI。HEADQUARTER runtime 应直接调用 `src/business/` use cases 与
`src/foundation/` projection/cursor/store 能力；public class 只保留兼容委托。

设备治理由 Agent SDK 持久 session 承载，不建立治理 event stream，也不调用
项目 CLI replay 还原治理对话。upstream 保留未确认治理请求并以稳定 requestId
重投；daemon 保存 session binding 和轻量去重/投递回执。详见
[Governance-sessions.md](./Governance-sessions.md)。

项目 V2 事件流由 [segmented-event-streams](../../../../01M3Y5QQ2ATPT8XWH3RCPZTHT8/outer/inner/ideal/Idea.md)
定义为 `events/` folder、每段至多 1000 条。其准确 head/cursor 是逻辑字节长度
与完整规范 folder digest；sequence 不是内容 HEAD。daemon 不直接读写该目录，
而通过 HEADQUARTER Silvermoon 按目标 repository schema 建立的权威运行时边界操作。

## 生产交互

针对 idea event stream 的上游输入携带它所依据的准确 stream HEAD。设备治理输入
不携带治理 HEAD，而由 upstream 按稳定 requestId 保留和重投。idea 输入处理遵循
以下顺序：

1. daemon 将输入的 `expectedHead` 原样交给对应 idea 流权威追加接口。
2. 权威接口原子地比较 `{ length, folderDigest }` 并追加规范事件。正常路径不先
   查询状态，也不先执行 `event replay`。
3. 若准确前缀之后已存在完全相同的规范事件，可确认幂等命中并返回原位置；
   相同 HEAD 本身不代表相同消息。返回 sequence 供排序，folder HEAD 供内容身份。
4. 若 expected HEAD 已陈旧且不能证明完全相同的事件已记录，返回 `stale` 与可用的
   当前 HEAD，直接交还上游。daemon 不刷新 HEAD 后替原输入重试，也不为该输入
   生成/投递下游工作；此前已合法开始的工作继续。
5. appended/idempotent 确认之后，Silvermoon 再按当前投影生成 handoff，daemon
   才将新 instruction 投递给 recipient。输入和生成的 instruction 不一一对应。

HEAD 是已交付分段事件流定义的长度 + folder digest；digest 覆盖全部规范 segment，
不只是 tail 或 sequence。未知追加结果通过观察同一准确前缀及其后规范事件解决；
不得用正文相似或换 HEAD 的重试猜测幂等。旧 `pong` 不能自动扩大成对新 `ping`
的回复。事件幂等命中也不证明 Agent instruction 未投递，不能触发自动重发。

生产协议应直接提供所需能力：

- 以 `{ expectedLength, expectedFolderDigest }` 乐观追加事件；
- 读取当前权威投影与准确 folder HEAD；
- 按 `{ afterLength, afterFolderDigest }` 从持久游标继续读取增量事件；
- 返回可区分 stale head、幂等命中和语义冲突的结构化结果；
- 在连接丢失或发送结果不确定时重新观察事实，而不是猜测成功或重复副作用。

前置实现提供了 cursor 增量 replay CLI，但它仍位于 `event replay` 诊断命令下。
daemon 生产路径不得启动该 CLI 子进程；项目 runtime 必须暴露满足同一 prefix
校验语义的生产 `readSince` 能力或专用 runtime 操作。不得因已有 cursor 参数就
把诊断命令改作生产接口。

schema v1 没有 v2 event stream，不能因为 `whats-next` 可读就推断 replay、delta
或 append capability。它只能明确受阻并指向独立 `migrate-v1-to-v2` 流程；daemon
不调用迁移入口替项目自动升级。

## 恢复边界

daemon 重启或重连时，从持久消费游标、当前项目投影、增量事件和真实 session
状态恢复。恢复的目标是重建 daemon 的调度观察，不是让 daemon 重新归约全部历史，
更不是重新执行历史副作用。

idea projection 的 snapshot `{ length, digest }` cursor 和持久消费 cursor 之后的
增量流必须衔接一致；重复事件按准确流位置处理，游标失效或缺口须显式报告与协调，
不静默漏掉事件或退回生产 replay。session 存在或 idle 不等于旧指令未执行；缺失的正式回复也不能
被假定可重放。启动前尚无已观察 head 时先初始化观察，不伪造 head 发起追加。

治理 session 恢复依赖 Agent SDK 的持久 session、upstream 未确认请求重投和本地
requestId receipts，不依赖 event replay。若实现声称治理对话恢复需要治理 event
stream，应先证明 Agent session/upstream 协议不足以提供所需保证。

如果 idea 恢复流程认为必须调用 `event replay`，应暂停实现并重新审视：

- 是否缺少读取当前 projection 的运行时操作；
- 是否缺少按 cursor 继续消费事件的能力；
- 是否没有持久化 daemon 自身的消费位置；
- 是否把 Silvermoon 内部 reducer 的职责泄漏成跨进程协议；
- 是否试图用历史重放掩盖发送结果不确定或 session 状态未知。

## 允许场景

`event replay` 可以用于：

- 开发期间检查事件归约和投影结果；
- 测试迁移、兼容性及损坏历史的错误报告；
- 运维人员明确发起的诊断或受控恢复；
- Silvermoon 内部实现复用同一归约器，但不以 CLI 子进程形成内部调用链。

任何新增的 daemon 或跨进程生产代码若引用 `event replay`，都应视为需要架构
复核的信号，并证明专用的状态查询、增量订阅或冲突处理接口确实无法满足需求。
