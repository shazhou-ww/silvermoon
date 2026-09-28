export type SilvermoonJsonOutput =
  | WhatsNextOutput
  | CreateIdeaOutput
  | CheckOutput;

export type SilvermoonCommand =
  | "whats-next"
  | "create-idea"
  | "check";

export type LanguageTag = string;
export type AbsolutePath = string;
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Silvermoon 观察到的一个项目或仓库整备问题。
 *
 * type 是稳定、非本地化的 kebab-case 标识。
 * summary 说明完整事实，必要 evidence 直接写入其中。
 */
export interface Problem {
  type: string;
  summary: string;
}

/**
 * Silvermoon 本次调用实际尝试的一项 repo 副作用操作。
 *
 * type 是稳定、非本地化的 kebab-case 标识。
 * summary 说明做了什么、结果如何，以及失败或部分完成时实际发生了什么。
 */
export interface Outcome {
  type: string;
  status: "success" | "failure";
  summary: string;
}

/**
 * 三个公共命令共享的内部对话 envelope。
 */
export interface SilvermoonEnvelope<TIntention> {
  intention: TIntention;
  observation: Observation;
  outcomes: Outcome[];
  instructions: string;
}

export type SilvermoonState =
  | "project-setup-required"
  | "repository-sync-required"
  | "task-pending"
  | "idle";

/**
 * 被观察的 repository version。
 *
 * commit.commit 是实际解析出的 commit；调用者请求的 revision 只存在于 intention。
 * remote.commit 是本次 remote observation 得到的 primary commit。
 * 无法解析或 fetch 时 commit 为 null，原因记录在 problems。
 */
export type ObservationVersion =
  | {
      type: "worktree";
    }
  | {
      type: "staged";
    }
  | {
      type: "commit";
      commit: string | null;
    }
  | {
      type: "remote";
      commit: string | null;
    };

/**
 * 当前 observation 中成功读取并理解的 Silvermoon project configuration。
 *
 * 配置缺失、无效或 schema 不兼容时不产生该字段，具体原因记录在 problems。
 */
export interface SilvermoonConfiguration {
  primaryRepository: string;
  primaryBranch: string;
  /**
   * 按 idea、project、user、default 优先级解析后的有效语言。
   */
  preferredLanguage: LanguageTag;
}

export type IdeaState =
  | "preparing"
  | "implementing"
  | "deploying"
  | "completed"
  | "abandoned";

export type ActiveIdeaState =
  | "preparing"
  | "implementing"
  | "deploying";

export interface ActiveIdeaReference {
  id: string;
  alias?: string;
  state: ActiveIdeaState;
}

export interface IdeaStateCounts {
  preparing: number;
  implementing: number;
  deploying: number;
  completed: number;
  abandoned: number;
}

/**
 * 当前 observed version 中的 idea inventory。
 *
 * 无法可靠检查 idea layout 时，Observation.ideas 为 null，而不是返回虚假的零值。
 */
export interface IdeaSummary {
  counts: IdeaStateCounts;
  activeIdeas: ActiveIdeaReference[];
}

/**
 * idle 保证不存在 active idea。
 */
export interface IdleIdeaSummary {
  counts: {
    preparing: 0;
    implementing: 0;
    deploying: 0;
    completed: number;
    abandoned: number;
  };
  activeIdeas: [];
}

/**
 * 项目尚未整备完成。
 *
 * observedThrough 表示本次调用已经可靠形成的最深 observation，不限制 problems
 * 一次报告所有可独立观察的问题。
 */
export type ProjectSetupRequiredObservation =
  | {
      state: "project-setup-required";
      observedThrough: "root";
      root: AbsolutePath;
      problems: NonEmptyArray<Problem>;
    }
  | {
      state: "project-setup-required";
      observedThrough: "version";
      root: AbsolutePath;
      version: ObservationVersion;
      problems: NonEmptyArray<Problem>;
    }
  | {
      state: "project-setup-required";
      observedThrough: "configuration";
      root: AbsolutePath;
      version: ObservationVersion;
      configuration: SilvermoonConfiguration;
      problems: NonEmptyArray<Problem>;
    }
  | {
      state: "project-setup-required";
      observedThrough: "ideas";
      root: AbsolutePath;
      version: ObservationVersion;
      configuration: SilvermoonConfiguration;
      ideas: IdeaSummary;
      problems: NonEmptyArray<Problem>;
    };

/**
 * 项目已整备，但 repository 尚未同步。
 */
export interface RepositorySyncRequiredObservation {
  state: "repository-sync-required";
  root: AbsolutePath;
  version: ObservationVersion;
  configuration: SilvermoonConfiguration;
  ideas: IdeaSummary;
  problems: NonEmptyArray<Problem>;
}

/**
 * 项目和 repository 均已整备，当前有 task 需要处理。
 */
export interface TaskPendingObservation {
  state: "task-pending";
  root: AbsolutePath;
  version: ObservationVersion;
  configuration: SilvermoonConfiguration;
  ideas: IdeaSummary;
  problems: [];
}

/**
 * 项目和 repository 均已整备，裸导航时没有 active idea。
 */
export interface IdleObservation {
  state: "idle";
  root: AbsolutePath;
  version: ObservationVersion;
  configuration: SilvermoonConfiguration;
  ideas: IdleIdeaSummary;
  problems: [];
}

/**
 * 所有命令共享、按 Silvermoon 递进状态判别的 repository observation。
 *
 * problems 只包含项目整备与仓库整备问题。Idea 的存在、数量和 lifecycle state
 * 是正常事实，不作为 problem。
 */
export type Observation =
  | ProjectSetupRequiredObservation
  | RepositorySyncRequiredObservation
  | TaskPendingObservation
  | IdleObservation;

export interface WhatsNextIntention {
  command: "whats-next";
  args: {
    /**
     * null 表示裸 whats-next，不替用户选择 idea。
     * string 表示用户显式提供的 ULID 或 alias selector。
     */
    idea: string | null;
  };
}

export type WhatsNextOutput = SilvermoonEnvelope<WhatsNextIntention>;

export interface CreateIdeaIntention {
  command: "create-idea";
  args: {
    /**
     * 规范化后的显式 BCP 47 tag。
     * null 表示动态继承 project、user 或默认语言。
     */
    language: LanguageTag | null;
  };
}

export type CreateIdeaOutput = SilvermoonEnvelope<CreateIdeaIntention>;

export type CheckTarget =
  | {
      type: "head";
    }
  | {
      type: "remote";
    }
  | {
      type: "commit";
      revision: string;
    }
  | {
      type: "staged";
    }
  | {
      type: "worktree";
    };

export interface CheckIntention {
  command: "check";
  args: {
    /**
     * 未指定 target flag 时，展开为 { type: "head" }。
     */
    target: CheckTarget;
  };
}

export type CheckOutput = SilvermoonEnvelope<CheckIntention>;

/**
 * Exit status:
 *
 * 0: Silvermoon formed a complete, trustworthy conversation envelope.
 * 1: An internal Silvermoon failure prevented a trustworthy envelope.
 * 2: Invalid CLI usage prevented a valid intention from being formed.
 *
 * Observation problems and failed outcomes do not change exit status 0.
 */
