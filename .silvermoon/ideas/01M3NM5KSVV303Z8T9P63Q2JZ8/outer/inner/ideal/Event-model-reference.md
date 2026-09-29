# Command Event Model Reference

本文是 [Idea.md](./Idea.md) 的非规范性设计参考。`Idea.md` 定义必须成立的
产品契约；本文保存讨论形成的函数式模型、Haskell 风格伪代码、event/trace
关系和实现不变量，帮助后续实现者理解设计理由。

## Conceptual model

一次 Silvermoon command run 可以表示为：

```text
normalized intention
        |
        v
ordered domain messages
        |
        +---- fold ----------> final observation
        |
        +---- projection ----> performed actions
        |
        +---- safe view -----> optional trace domain events

response = respond(intention, final observation)
```

Intention 是事件流的种子，Observation 是事件流的状态归约，Actions 是同一事件
流的副作用投影，Response 是 Intention 与最终 Observation 的纯函数。Perf
trace 是这个过程的可选观测视图，不是业务状态来源。

## Public projections

```haskell
data Report = Report
  { intention   :: Intention
  , observation :: PublicObservation
  , actions     :: [ActionRecord]
  , response    :: Response
  }

data Intention
  = WhatsNext
      { selector       :: Maybe IdeaSelector
      , outputLanguage :: Maybe OutputLanguage
      }
  | CreateIdea
      { contentLanguage :: Maybe LanguageTag
      }
  | Check
      { target         :: CheckTarget
      , outputLanguage :: Maybe OutputLanguage
      }
  | ListIdeas
      { query :: IdeaQuery
      }

data Response
  = NextSteps
      { summary   :: Text
      , nextSteps :: NonEmpty NextStep
      , guidance  :: Maybe PhaseGuidance
      }
  | ChoiceRequired
      { summary :: Text
      , choices :: [Choice]
      }
  | IdeaCreated
      { summary   :: Text
      , nextSteps :: [NextStep]
      , guidance  :: Maybe PhaseGuidance
      }
  | ValidationResult
      { summary :: Text
      , valid   :: Bool
      }
  | IdeaList
      { summary :: Text
      , items   :: [IdeaReference]
      }
  | BlockedResponse
      { summary   :: Text
      , nextSteps :: [NextStep]
      }
```

`Response` 是 discriminated union，而不是一个承担全部语义的 prose string。
各 command 可以拥有适合自己的 response variant。机器需要依赖的事实仍来自
structured observation 或 action result；response 中的重复数据是可重新计算的
projection，不是第二个事实来源。

## Domain messages

```haskell
data DomainEvent
  = IntentionAccepted Intention
  | FactObserved Fact
  | ActionRequested ActionId Action
  | ActionFinished ActionId Action ActionResult

data Fact
  = RootResolved RepositoryRoot
  | ProjectLoaded ProjectFacts
  | WorktreeObserved WorktreeFacts
  | PrimaryTipObserved CommitId
  | RepositoryRelationObserved RepositoryRelation
  | IdeasObserved IdeaFacts
  | IdeaSelected IdeaView
  | IdeaCreatedObserved CreatedIdea
  | GuidanceObserved PhaseGuidance
  | CleanupObserved CleanupResult
  | ProblemObserved Problem
  | ProgressChanged Progress

data Action
  = FetchPrimary RepositoryUrl BranchName
  | CreateIdeaScaffold IdeaScaffold
  | RemoveOwnedCreationPaths [FilePath]

data ActionResult
  = FetchSucceeded CommitId
  | FetchFailed Problem
  | ScaffoldCreated CreatedIdea
  | ScaffoldCreationFailed Problem CleanupResult
  | CleanupCompleted CleanupResult

data ActionRecord = ActionRecord
  { actionId :: ActionId
  , action   :: Action
  , status   :: ActionStatus
  }

data ActionStatus
  = Requested
  | Succeeded ActionResult
  | Failed ActionResult
```

Domain event payload 使用稳定 code、identifier、path、revision 和结构化 value，
不预先本地化成 sentence。Usage parsing 在 domain run 之前完成；只有参数合法并
规范化后才发出首条 `IntentionAccepted`。

## Observation reducer

```haskell
data Observation = Observation
  { progress   :: Progress
  , root       :: Maybe RepositoryRoot
  , project    :: Maybe ProjectFacts
  , repository :: Maybe RepositoryFacts
  , ideas      :: Maybe IdeaFacts
  , command    :: Maybe CommandFacts
  , problems   :: [Problem]
  }

data Progress
  = Initial
  | ObservingProject
  | ObservingRepository
  | ObservingCommand
  | Ready
  | Blocked

initialObservation :: Observation
initialObservation =
  Observation
    { progress   = Initial
    , root       = Nothing
    , project    = Nothing
    , repository = Nothing
    , ideas      = Nothing
    , command    = Nothing
    , problems   = []
    }

reduceObservation
  :: Observation
  -> DomainEvent
  -> Either InvariantViolation Observation

reduceObservation state event =
  case event of
    IntentionAccepted _ ->
      Right state

    FactObserved fact ->
      applyFact state fact

    ActionRequested _ _ ->
      Right state

    ActionFinished _ action result ->
      foldM applyFact state (factsFromActionResult action result)
```

Action history 不直接输入 response，但会影响调用者下一步的 action result 必须
转化为 observation facts：

```haskell
factsFromActionResult
  :: Action
  -> ActionResult
  -> [Fact]

factsFromActionResult action result =
  case (action, result) of
    (FetchPrimary _ _, FetchSucceeded commit) ->
      [ PrimaryTipObserved commit
      , ProgressChanged ObservingRepository
      ]

    (FetchPrimary _ _, FetchFailed problem) ->
      [ ProblemObserved problem
      , ProgressChanged Blocked
      ]

    (CreateIdeaScaffold _, ScaffoldCreated idea) ->
      [ IdeaCreatedObserved idea
      , ProgressChanged Ready
      ]

    (CreateIdeaScaffold _, ScaffoldCreationFailed problem cleanup) ->
      [ ProblemObserved problem
      , CleanupObserved cleanup
      , ProgressChanged Blocked
      ]

    _ ->
      [ ProblemObserved incompatibleActionResult
      , ProgressChanged Blocked
      ]
```

因此例行 fetch 成功可以只留在 actions；fetch failure、created idea 或未完成
cleanup 等会改变回复的结果必须同时进入 final observation。

## Actions projection

Actions 不能由另一份可变数组独立维护，而应从相同 domain events 投影：

```haskell
projectActions :: [DomainEvent] -> [ActionRecord]
projectActions events =
  finalizeActionRecords $
    foldl' step emptyActionProjection events
  where
    step projection event =
      case event of
        ActionRequested actionId action ->
          recordRequested actionId action projection

        ActionFinished actionId action result ->
          recordFinished actionId action result projection

        _ ->
          projection
```

`actions` 只表示 Silvermoon 在本次 invocation 中已经尝试的外部操作。调用者未来
应做什么只存在于 `response.nextSteps`，不能与 action history 混用。

## Pure response

```haskell
respond
  :: Intention
  -> Observation
  -> Maybe Response

respond intention observation
  | progress observation == Blocked =
      Just $
        BlockedResponse
          { summary   = renderBlockingSummary intention observation
          , nextSteps = remediationSteps intention observation
          }

  | progress observation /= Ready =
      Nothing

  | otherwise =
      Just $
        case intention of
          WhatsNext {} ->
            respondToWhatsNext observation

          CreateIdea {} ->
            respondToCreateIdea observation

          Check {} ->
            respondToCheck observation

          ListIdeas {} ->
            respondToListIdeas observation
```

`Nothing` 表示 observation 尚未达到可回复状态。`respond` 不读取 filesystem、
Git、网络、当前时间、trace 或 actions projection。输出语言 override 属于
intention，从项目或用户配置解析出的语言属于 observation，因此 localization
仍可保持纯函数。

## Pure decision and imperative effects

读取外部世界同样是 effect，但只有对外部状态有意义的操作进入 public actions：

```haskell
data Effect
  = Derive (NonEmpty DomainEvent)
  | Observe Probe
  | Perform Action

data Probe
  = ResolveRepositoryRoot
  | LoadProject
  | InspectWorktree
  | InspectIdeas
  | LoadPhaseGuidance Phase

data Decision
  = Continue Effect
  | Finish Response

decide
  :: Intention
  -> Observation
  -> Either InvariantViolation Decision

decide intention observation =
  case respond intention observation of
    Just response ->
      Right (Finish response)

    Nothing ->
      Continue <$> nextEffect intention observation
```

Effect driver 是唯一执行 IO 的 imperative shell：

```haskell
data Ports m = Ports
  { runProbe    :: Probe  -> m (NonEmpty DomainEvent)
  , runAction   :: Action -> m ActionResult
  , newActionId :: m ActionId
  }

data RuntimeState = RuntimeState
  { domainEvents       :: Seq DomainEvent
  , currentObservation :: Observation
  }

runCommand
  :: Monad m
  => Ports m
  -> EventSink m
  -> Intention
  -> m Report

runCommand ports sink intention = do
  finalState <-
    execStateT
      (recordDomain sink (IntentionAccepted intention) >> drive)
      initialRuntimeState

  pure $ reportFromEvents (toList $ domainEvents finalState)
  where
    drive = do
      state <- get

      case decide intention (currentObservation state) of
        Left invariantError ->
          throwInternal invariantError

        Right (Finish _) ->
          pure ()

        Right (Continue effect) -> do
          executeEffect ports sink effect
          drive
```

```haskell
executeEffect ports sink effect =
  case effect of
    Derive events ->
      traverse_ (recordDomain sink) events

    Observe probe -> do
      events <-
        lift $
          traced ("probe." <> probeName probe) $
            runProbe ports probe

      traverse_ (recordDomain sink) events

    Perform action -> do
      actionId <- lift $ newActionId ports

      recordDomain sink $
        ActionRequested actionId action

      result <-
        lift $
          traced ("action." <> actionName action) $
            runAction ports action

      recordDomain sink $
        ActionFinished actionId action result
```

记录 domain event 时先更新内存状态，再把安全投影交给可选 trace sink：

```haskell
recordDomain
  :: Monad m
  => EventSink m
  -> DomainEvent
  -> StateT RuntimeState m ()

recordDomain sink event = do
  state <- get

  observation' <-
    either throwInternal pure $
      reduceObservation
        (currentObservation state)
        event

  put state
    { domainEvents =
        domainEvents state |> event
    , currentObservation =
        observation'
    }

  lift $ emitDomainTrace sink (redactForTrace event)
```

Expected domain failures 由 `ActionResult`、`ProblemObserved` 和最终 response
表达；违反 reducer invariant 或无法形成可信 report 的意外错误才走 exception、
stderr 与 failed span。

## Final report projection

```haskell
reportFromEvents :: [DomainEvent] -> Report
reportFromEvents events =
  let
    intention =
      projectIntention events

    internalObservation =
      foldEvents reduceObservation initialObservation events

    observation =
      projectPublicObservation internalObservation

    actions =
      projectActions events

    response =
      fromMaybe
        (internalInvariantFailure "event stream did not reach a response")
        (respond intention internalObservation)
  in
    Report
      { intention
      , observation
      , actions
      , response
      }
```

Internal observation 可以保存生成 response 所需的完整事实；public observation
可以执行稳定的安全 projection。Response 可以重复展示 observation 中的数据，
但因为它始终由纯函数生成，这种重复不是另一个 source of truth。

## Unified domain and performance trace

Domain events 与现有 perf spans 可共享物理 JSONL、run identity 和全局顺序，但
必须使用不同 channel：

```haskell
data Channel
  = Domain
  | Telemetry

data RunEventBody
  = DomainBody RedactedDomainEvent
  | TraceBody TraceEvent

data RunEvent = RunEvent
  { schemaVersion :: Int
  , traceId       :: TraceId
  , sequence      :: Word64
  , timestamp     :: UTCTime
  , channel       :: Channel
  , body          :: RunEventBody
  }

data EventSink m = EventSink
  { emitDomainTrace :: RedactedDomainEvent -> m ()
  , emitTelemetry   :: TraceEvent         -> m ()
  }
```

示例：

```json
{"sequence":1,"channel":"domain","event":"intention.accepted"}
{"sequence":2,"channel":"telemetry","event":"span-start","name":"project.inspect"}
{"sequence":3,"channel":"domain","event":"observation.project-loaded"}
{"sequence":4,"channel":"telemetry","event":"span-end","name":"project.inspect"}
{"sequence":5,"channel":"domain","event":"action.requested","action":"fetch-primary","actionId":"a1"}
{"sequence":6,"channel":"domain","event":"action.finished","actionId":"a1","status":"success"}
{"sequence":7,"channel":"domain","event":"observation.primary-tip-observed","commit":"abc123"}
```

Reducer 只消费 domain channel：

```haskell
reduceRunEvent observation runEvent =
  case body runEvent of
    DomainBody domainEvent ->
      reduceObservation observation domainEvent

    TraceBody _ ->
      Right observation
```

Domain messages 无论是否启用 `--trace` 都完整存在于内存。Trace 只记录经过
allowlist/redaction 的安全投影，例如 event type、stable ID、state、hash、count、
action/span correlation 和 timing；不记录 guidance 正文、文件正文、Git argv、
stdout/stderr、环境变量、credential 或其他潜在敏感 payload。

首版继续使用当前 buffered、exclusive-create trace file 行为。完整可重放的持久
journal、实时 stdout/stderr event streaming、sampling 和跨进程 aggregation
不属于本模型；未来如需要完整 journal，应使用独立显式能力和更严格的数据策略。

## Observable event sequence

一次正常的 selected `whats-next` 可以产生：

```text
intention.accepted
observation.root-resolved
observation.project-loaded
observation.worktree-clean
action.requested(fetch-primary)
action.finished(fetch-primary, success)
observation.primary-tip-observed
observation.repository-relation-observed(aligned)
observation.idea-selected
observation.phase-guidance-observed
observation.ready
response.produced(next-steps)  -- optional trace projection only
```

如果 fetch 失败：

```text
action.finished(fetch-primary, failure)
observation.problem-observed(primary-fetch-failed)
observation.blocked
response.produced(blocked)
```

`response.produced` 可以把 kind、语言和内容 hash 写入 trace，便于关联，但不是
observation reducer 的输入，也不是最终 response 的权威来源。

## Required properties

```haskell
prop_responseIsPure events =
  let report = reportFromEvents events
  in response report
      == respond
           (intention report)
           (internalObservationFrom events)

prop_replayIsDeterministic events =
  reportFromEvents events
    == reportFromEvents events

prop_telemetryIsSemanticallyInvisible domainEvents traceEvents =
  reduceAll (interleave domainEvents traceEvents)
    == reduceAll (map DomainBody domainEvents)

prop_actionsAreProjection events =
  actions (reportFromEvents events)
    == projectActions events

prop_traceFlagDoesNotChangeReport intention =
  domainReport (runWithoutTrace intention)
    == domainReport (runWithTrace intention)
```

还应验证：

- event sequence 连续、有版本、同一 run 使用同一 trace ID；
- action request/result 使用唯一 action ID，并可关联所属 perf span；
- action result 影响下一步时必然产生对应 observation fact；
- response 不读取 actions、trace、filesystem、Git、network、clock 或 randomness；
- 默认文本只渲染 response，JSON 输出四个最终 projection；
- stderr 只承载 usage/internal failure，不承载 domain messages；
- 删除全部 telemetry events 不改变 final observation、actions 或 response；
- trace 写入失败不能产生与未启用 trace 不同的 domain decision。
