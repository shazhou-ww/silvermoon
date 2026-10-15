# Whats-next check 与 problem 状态图

本图按三个 bundled objective manifest 的 prerequisite 与 level/check 顺序定义单一
主链。阻塞 check 通过时只有一个出口，前进到下一个 check；失败时由该 prerequisite
保留当前 owner，并按完整 Problem 集和报告阶段分支。采集失败语料后修复状态并回到
该 check，再沿唯一通过边继续。不可逆状态从最近可复用 checkpoint 派生场景。

## 主链

```text
Device (Project prerequisite through update-unconfirmed):
device-config-valid
  -> device-runtime-linked
  -> device-skill-discoverable
  -> update-unconfirmed
       -> device-update-current (observed, non-blocking for Project/Idea)

Project (after Device reaches update-unconfirmed; Idea prerequisite):
project-config-valid
  -> project-user-config-valid
  -> project-layout-valid
  -> project-adopted
  -> project-schema-ready
  -> project-guidance-valid
  -> repository-worktree-clean
  -> repository-head-present
  -> repository-upstream-matches
  -> repository-primary-fetched
  -> repository-primary-aligned
  -> repository-event-history-valid
  -> project-primary-guidance-valid

Idea (only after Project and explicit selection):
idea-metadata-valid
  -> idea-contracts-valid
  -> idea-ideal-submitted
  -> idea-ideal-accepted
  -> idea-inner-submitted
  -> idea-inner-accepted
  -> idea-outer-submitted
  -> idea-outer-accepted
```

Project 要求 Device 先到达 `update-unconfirmed`，因此 device configuration、runtime
或 skill 失败时，Device 是整条 Objective 链的唯一当前 owner，Project/Idea 不再同时
给出行动。`device-update-current` 仍会被观测；其失败不阻断 Project/Idea，但显式
Device target 仍需通过它才能到达 terminal。Project 是 Idea Objective 的
prerequisite。未提供 selector 或 selector 不存在时，执行 navigation 补充场景，不
进入 Idea 主链。每个 manifest level 内严格按表中 check 顺序执行，首个阻塞失败即
停止该次 probe。

## 失败边与报告阶段

下表列出 check runner 的失败 Problem ID。Problem 集中的动态参数和同一 check 的不同
状态变体，须由场景脚本分别构造并从真实报告采集。阶段为失败时的 Objective
level；报告中的 repository/project problem details 也应原样保存。

| 顺序 | Check | 失败报告阶段 | 失败 Problem ID / 变体 |
| ---: | --- | --- | --- |
| 1 | `device-config-valid` | Device `configuration-invalid` | `device-configuration` |
| 2 | `device-runtime-linked` | Device `runtime-unready` | `device-runtime` |
| 3 | `device-skill-discoverable` | Device `skill-unready` | `device-skill` |
| 4 | `device-update-current` | Device `update-unconfirmed` | `device-update` |
| 5 | `project-config-valid` | Project `configuration-invalid` | `project`；config 类 snapshot problem 集，或无诊断时的 project state |
| 6 | `project-user-config-valid` | Project `configuration-invalid` | `project`；各 distinct `user-*` snapshot problem 集 |
| 7 | `project-layout-valid` | Project `configuration-invalid` | `project`；各 distinct `idea-*` / `layout-*` snapshot problem 集 |
| 8 | `project-adopted` | Project `project-unprepared` | `project`；`git-*`、`not-adopted`、`config-missing` |
| 9 | `project-schema-ready` | Project `project-unprepared` | `project`；migration、runtime-upgrade、runtime-refresh 类 problem 集 |
| 10 | `project-guidance-valid` | Project `project-unprepared` | `guidance`；每种 distinct guidance diagnostic 集，报告 `phase-guidance-invalid` |
| 11 | `repository-worktree-clean` | Project `repository-unready` | `repository`；`worktree-conflicts`、`worktree-changes`、`worktree-inspection-failed` 及不同组合 |
| 12 | `repository-head-present` | Project `repository-unready` | `repository`；`head-missing` |
| 13 | `repository-upstream-matches` | Project `repository-unready` | `repository`；`detached-head`、`primary-upstream-mismatch` |
| 14 | `repository-primary-fetched` | Project `primary-unconfirmed` | `repository`；`primary-fetch-failed` |
| 15 | `repository-primary-aligned` | Project `primary-unconfirmed` | `repository`；`primary-ahead`、`primary-behind`、`primary-diverged`、`primary-ancestry-inspection-failed`、`primary-history-incomplete` |
| 16 | `repository-event-history-valid` | Project `primary-unconfirmed` | `repository`；`idea.events.history-invalid` |
| 17 | `project-primary-guidance-valid` | Project `primary-unconfirmed` | `guidance`；primary snapshot 的每种 distinct guidance diagnostic 集，报告 `phase-guidance-invalid` |
| 18 | `idea-metadata-valid` | Idea `configuration-invalid` 或运行时阻断状态 | `idea-configuration`；`project-setup-required` / `idea-metadata-unavailable`；`repository-sync-required` / `worktree-changes`；`idea-inactive` / abandoned |
| 19 | `idea-contracts-valid` | Idea `configuration-invalid` | `idea-configuration` |
| 20 | `idea-ideal-submitted` | Idea `ideal-unsubmitted` | `ideal` |
| 21 | `idea-ideal-accepted` | Idea `ideal-unaccepted` | `ideal` |
| 22 | `idea-inner-submitted` | Idea `implementation-unsubmitted` | `inner` |
| 23 | `idea-inner-accepted` | Idea `implementation-unaccepted` | `inner` |
| 24 | `idea-outer-submitted` | Idea `deployment-unsubmitted` | `outer` |
| 25 | `idea-outer-accepted` | Idea `deployment-unaccepted` | `outer` |

Project checks 会按类别筛选 snapshot problems，并可能将多个底层诊断聚合到单个
`project` Problem；仅记录 Problem ID 不足以代表输出覆盖。场景须分别构造每个实际
不同的诊断集并采集最终报告。`repository` 类检查也要分别采集不同的 problem
details。生命周期 checks 虽共用 `ideal`、`inner`、`outer` Problem ID，未提交、未
接受、stale revision 等状态造成的不同阶段输出仍须分别覆盖。

## 状态转移规则

1. Docker 场景从空设备只初始化一次；主链 checkpoint 逐步构造每个 check 的通过状态。
2. 为采集目标 check 的失败语料，先确保该 check 之前的 checks 均通过，再构造失败状态。
3. 对目标 check 的每种可达 Problem 集运行真实全局 `silvermoon whats-next`，保存完整
   输出、problem array、objective 阶段、locale、命令和 revision。
4. 修复后重跑同一 check；通过后只能前进到表中的唯一下一个 check。
5. 只有不可逆、互斥或无法安全回归的 problem 状态才从最近 checkpoint 派生 Docker
   场景，并记录不能复用主链的原因。
6. 将无 selector、selector not found、navigation-ready 和各 objective terminal 输出
   作为非 check 补充节点覆盖。
