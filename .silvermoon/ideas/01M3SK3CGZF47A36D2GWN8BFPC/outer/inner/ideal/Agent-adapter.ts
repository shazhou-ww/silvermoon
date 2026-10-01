/**
 * Ideal World 的 Agent 适配接口设计契约，不是可运行的适配器。
 * 一个调用方进程为每种 Agent 加载一个适配器实例；同一实例管理多个项目和 session。
 * 项目事件只由项目版本 Silvermoon 校验和追加，适配器不解释生命周期。
 */

/**
 * worktreePath 指定项目及执行位置；同一 idea 同时只关联一个 worktree。
 * 路径迁移须显式处理，不能被视为一个全新的 idea。
 */
export interface IdeaRoute {
  readonly worktreePath: string;
  readonly ideaId: string;
}

export interface AdapterCapabilities {
  readonly resumeSession: boolean;
  /** 从低到高；适配器只声明实际能提供的观察粒度。 */
  readonly observation: "session" | "activity" | "activityDetails";
  readonly sendWhileRunning: boolean;
}

/** 单次投递的递进观察，不写入项目事件日志。 */
export type Delivery =
  | { readonly state: "queued"; readonly boundary: string }
  | { readonly state: "delivered"; readonly boundary: string }
  | { readonly state: "processed"; readonly boundary: string }
  | { readonly state: "unknown"; readonly reason: string };

export type SessionObservation =
  | { readonly type: "session"; readonly state: "running" | "idle" | "gone" }
  | { readonly type: "session"; readonly state: "unknown"; readonly reason: string }
  | { readonly type: "message"; readonly text: string }
  | {
      readonly type: "tool";
      readonly toolCallId: string;
      readonly name: string;
      readonly state: "started" | "succeeded" | "failed";
    }
  | {
      readonly type: "toolDetails";
      readonly toolCallId: string;
      readonly name: string;
      readonly state: "started";
      readonly input: string;
    }
  | {
      readonly type: "toolDetails";
      readonly toolCallId: string;
      readonly name: string;
      readonly state: "succeeded";
      readonly output: string;
    }
  | {
      readonly type: "toolDetails";
      readonly toolCallId: string;
      readonly name: string;
      readonly state: "failed";
      readonly error: string;
    };

/**
 * Agent session ID 是适配器内部细节。适配器持久保存 route 到 session 的
 * 关联并在进程重启后恢复；同一 route 同时至多有一个有效 session。
 * 无法确认旧 session 是否仍有效时，不得暗中创建替代会话。
 */
export interface AgentAdapter {
  capabilities(): Promise<AdapterCapabilities>;

  /** 只为没有有效 session 的 route 新建；不得隐式替换尚未确认失效的会话。 */
  start(route: IdeaRoute): Promise<void>;

  /**
   * 先给出当前 session 状态，再持续报告已声明粒度的活动：
   * activity 包含 Agent 发给用户的过程消息及工具状态；
   * activityDetails 还可包含工具输入输出。过程消息不是正式 pong，
   * 不能作为项目事件追加。观察不由 Silvermoon 保存为完整执行日志；
   * 适配器只声明实际能获取的粒度，不伪造缺失的内容。
   * 无法确认时报告 unknown，不新建会话或重放执行。
   */
  observe(route: IdeaRoute): AsyncIterable<SessionObservation>;

  /**
   * 向 route 关联的 session 投递已写入项目日志的消息，不等待 Agent 回复。
   * 返回单次投递的状态流；queued 必须说明实际消费边界，不能冒充
   * delivered；processed 或 unknown 是终态，流不得悄然提前结束。
   * 取消观察不等于取消投递；未知结果不能当作未执行而盲目重发。
   * 项目日志中的消息身份和去重由调用方处理，不从 message 正文推断。
   */
  send(route: IdeaRoute, message: string): AsyncIterable<Delivery>;

  /**
   * 持续接收独立于 send 的 Agent 正式回复；不要求请求/回复交替。
   * 连接中断须显式报错并通过 observe 判断状态；不能把流结束
   * 当作没有遗漏输出或工作已完成。
   * 回复是项目事件追加提议；项目版本 Silvermoon 负责持久化、
   * 回放和去重。追加时若与新指令冲突，调用方重新观察并确认
   * 回复范围，不能自动扩大旧回复。
   */
  events(route: IdeaRoute): AsyncIterable<string>;
}
