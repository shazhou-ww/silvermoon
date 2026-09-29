# Implementation

## Steps

### I-S01: 定义 domain message 与 projection contracts

建立 versioned、discriminated domain event types，包括 normalized intention、
observation facts、action request/result 与 command progress。定义 internal
observation、public observation、action records 和 command-specific response
variants，确保 payload 使用稳定 machine fields 而不是本地化 prose。以
[Event-model-reference.md](./ideal/Event-model-reference.md) 为设计参考，但以
[Idea.md](./ideal/Idea.md) 的边界为规范合同。

### I-S02: 实现 observation reducer 与 actions projector

以唯一 reducer 从 ordered domain events 计算 immutable observation，并以独立
纯 projector 从同一事件序列配对 action IDs、生成 actions。将 fetch、scaffold、
cleanup、snapshot、guidance、validation 和 selection 的 result 转换为结构化
facts；拒绝非法 transition、重复或缺失 action completion 和 success-shaped
fallback。

### I-S03: 建立 functional core 与 imperative effect driver

把 command policy 重构为
`decide(intention, observation) -> probe | action | response`。文件系统、Git、
network 和 mutation 只存在于注入式 probe/action interpreters；driver 依次执行
effect、发布 domain messages 并推进 reducer，直到 observation 能产生 response。
迁移 `whats-next`、`create-idea`、`check` 及届时已公开的 `list-ideas`，保持各自
readiness、mutation 和 exit-code 语义。

### I-S04: 以纯函数生成并渲染 response

实现 command-specific response discriminated unions 和
`respond(intention, internalObservation)`，移除顶层 instructions。Response
自足地携带默认文本所需的 summary、nextSteps、choices、items、validation 或
guidance；renderer 不再按内部四阶段逐段展示。默认 stdout 只渲染 response，
`--json` 输出完整 `{ intention, observation, actions, response }`，stderr 仅
用于 usage/internal failure。

### I-S05: 整合 domain messages 与 performance trace

升级 trace schema，在同一 trace ID 和全局 sequence 下区分 `domain` 与
`telemetry` channel。保留现有 nested perf span、duration、error status、
buffered write 和 exclusive creation；增加经过 allowlist/redaction 的 intention、
observation transition、action lifecycle 和 response metadata。Trace sink 可
替换为 no-op，且不得影响 domain execution。

### I-S06: 迁移 feature integrations、文档与测试

让 output-language、phase-guidance、snapshot checks、create cleanup 和现有
dialogue states 使用新模型；协调仍约定旧 report shape 的 active idea，不静默
违背其批准 revision。更新 public API、CLI help、README、core concepts、
operations、reference、repository tasks、canonical/generated skills 和 trace
说明，并增加 reducer、projection、driver、renderer、contract、integration、
E2E 与 property-style tests。

### I-S07: 准备 0.2.0 RC implementation candidate

在当前 0.1.x release 工作完成且 event-model 实现验证通过后，将 package manifest
和相关精确版本引用准备为首个可用的 `0.2.0-rc.1` candidate。运行完整
release-grade 验证并发布实现证据到 primary，但不创建 Git tag、不调用 npm
publish，也不把 implementation completion 当作发布授权。

## Acceptance criteria

### I-AC01: 同一 domain stream 可确定性重建 report

任意合法 event sequence 都能唯一投影出 normalized intention、final
observation、paired actions 和 response；重复 replay 字节等价，非法顺序产生
明确 invariant failure。通过 reducer/projector unit tests、生成式 sequence
cases 和 complete-report snapshots 证明。

### I-AC02: Response 只依赖 intention 与 internal observation

Response generator 不调用 IO、不读取 actions/trace/clock/randomness，且所有
会改变调用者下一步的 action consequence 都已进入 observation。通过 dependency
injection guards、纯函数 tests，以及改变 incidental action history但保持最终
observation 时 response 不变的 metamorphic tests 证明。

### I-AC03: Effect 执行与 action history 精确对应

每个外部 action 在执行前产生唯一 requested event，在结束后产生一次 success
或 failure result；正常 final report 无悬空 action。Probe 与 action 的职责、
expected failure 和 unexpected exception 明确分离。通过 fake ports、call
counts、failure/cleanup matrix 与 action projection assertions 证明不会重复或
遗漏副作用。

### I-AC04: 四字段 public report 覆盖全部命令

所有成功和可信 blocked JSON reports 恰好使用
`intention/observation/actions/response`，不再暴露顶层 outcomes/instructions。
Actions 只含已尝试操作，未来步骤只在 response；每个 command 的 response variant
能表达结果、选择、阻塞或下一步。通过 exact-key CLI/API contract tests 和旧字段
absence assertions 证明。

### I-AC05: 默认输出 answer-first 且 stderr 保持纯净

默认 Markdown 只渲染 self-contained response，不展示内部 intention、
observation 或 action stream；必要的 ID、revision、problem 和 consequence 由
response 确定性带入。成功和可信 blocker 不写 stderr，usage/internal failure
分别保持 exit `2`/`1`。通过 stdout/stderr process tests 和 JSON/text semantic
parity 证明。

### I-AC06: Unified trace 保留性能并解释业务路径

启用 trace 时，同一 JSONL 以全局连续 sequence 交错记录 domain-safe events 和
paired telemetry spans；action/span correlation、duration、parent hierarchy、
failure status 和 trace ID 可验证。关闭 trace、使用 no-op sink 或删除全部
telemetry events不改变 final report。通过 trace schema tests、timing tests 和
trace-on/off differential tests 证明。

### I-AC07: Trace 不泄露完整 domain payload

Trace 只记录 allowlisted type、state、stable ID、hash、count 和 correlation；
不出现 guidance/file content、Git argv/stdout/stderr、environment、credential
或 token。恶意内容、超长错误与路径 fixtures 仍生成安全可诊断 trace。通过
secret canaries、field allowlist 和 JSONL inspection 证明。

### I-AC08: 现有行为完成一致迁移

Repository readiness ordering、create ownership cleanup、snapshot isolation、
language override、phase-guidance provenance 和 check validity 在新 runtime 下
保持既有业务语义。默认文本有意简化，JSON 有意升级；不得出现部分命令使用旧
protocol 的混合版本。通过现有 suite 迁移、cross-command matrix 和 installed
package E2E 证明。

### I-AC09: 0.2.0-rc.1 candidate 可供明确验收

实现完成时，manifest 为尚未发布且 tag 不存在的 `0.2.0-rc.1`，release docs 与
精确版本断言同步，完整 `pnpm check`、`pnpm check:skills`、pack checks、
installed E2E、Markdown links、`git diff --check` 和 Silvermoon
worktree/staged/remote checks 全部通过。候选提交从 `origin/main` 可达，但 npm
和 release tag 均未因实现完成自动产生。

## Verification evidence

- `src/domain.js` 现以 version 1 discriminated messages 维护单一 ordered
  stream；immutable reducer、intention/actions/report projectors、纯
  `respond` 边界、injected probe/action driver、terminal response metadata
  和 sequence/action invariants 均由 `test/unit/domain.test.js` 覆盖。生成式
  action sequence、deterministic replay、非法 transition、fake-port call
  count 以及改变 incidental action history 的 metamorphic case 均通过。
- `whats-next`、`create-idea` 与全部 `check` targets 已迁移到同一
  `CommandRun`。Fetch、scaffold 与 owned-path cleanup 都形成唯一
  `action.requested`/`action.finished` pair；snapshot、readiness、selection、
  guidance、validation、created idea 与 cleanup consequence 均作为 typed
  observation fact 进入 reducer。成功和可信 blocker 的 public report 恰好为
  `intention/observation/actions/response`。
- `src/response.js` 是唯一默认 Markdown renderer；CLI 默认只传入
  `report.response`，而 `--json` 返回完整四 projection。Guidance 正文只保留在
  internal observation 与 response，public observation 只暴露 phase、path 和
  content revision。unit、contract、integration 与 installed-package E2E
  覆盖中英文输出、stderr/exit code、JSON/text semantic parity 和 hostile
  guidance 隔离。
- `src/trace.js` 与 `schema/v2/trace-event.schema.json` 在同一 trace ID 和全局
  sequence 中交错 `domain`/`telemetry` channel。实际 CLI trace 逐 event 通过
  strict schema，并验证 message sequence、nested spans、action ID correlation、
  duration/failure、trace-on/off report 等价、buffered exclusive write，以及
  intention、credential、path、guidance、Git output 与超长 error canary 不泄露。
- `schema/v1/command-report.schema.json` 与
  `schema/v1/domain-message.schema.json` 随 package 发布；strict AJV tests
  验证 runtime 真实生成的 report 和每条 domain message。Public API、README、
  core concepts、operations、reference、repository tasks、release docs 和
  canonical/generated skills 已同步。
- `list-ideas` idea `01M3NDKZT9RTHDEN0JS053F1YB` 在此 candidate 基线尚未公开，
  且其 approved revision `ec5dee9bc34dec81903b72b3380f75eccea0239d`
  仍描述旧两字段 JSON。此次只在 event model、schema 与 response union 中保留
  `list-ideas`/`idea-list` integration surface，没有合入或改写该独立批准事实；
  该 idea 发布前必须在自身 lifecycle 重新协调四 projection contract。
- 2026-09-29 已准备 manifest `0.2.0-rc.1`。npm registry 返回该版本不存在，
  local/remote `npm/silvermoon/v0.2.0-rc.1` tag 均不存在；未创建 tag、未调用
  publish workflow、未发布 npm package。候选通过 unit、contract、integration、
  pack、installed-package E2E、skill sync 与针对性 schema/trace checks。最终
  `pnpm check` 通过 61 unit、29 contract、104 integration（102 pass、2 个
  Windows privilege skip）及 1 installed-package E2E；candidate CLI worktree
  check 与 `git diff --check` 通过。发布同一 candidate 时继续执行 staged 与
  refreshed remote snapshot checks。
