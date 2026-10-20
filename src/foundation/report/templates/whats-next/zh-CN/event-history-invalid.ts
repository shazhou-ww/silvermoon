/**
 * @template event-history-invalid
 * @when project.version=2 repository.eventHistory=invalid
 * 用于已对齐 primary 的事件边界校验失败时。
 */
import type { EventHistoryInvalidParameters } from "../contract.ts";

/** @pure */
const eventHistoryInvalid = (
  _parameters: EventHistoryInvalidParameters,
) =>
  `目标是在保留双方历史的前提下，让所选提交边界具有有效的 append-only 事件历史；仅修复已获得明确授权的错误。`;

export default eventHistoryInvalid;
