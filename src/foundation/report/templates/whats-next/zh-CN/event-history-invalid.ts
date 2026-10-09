/**
 * @template event-history-invalid
 * @when project.version=2 repository.eventHistory=invalid
 * 用于已对齐 primary 的事件边界校验失败时。
 */
import type { EventHistoryInvalidParameters } from "../contract.ts";

/** @pure */
const eventHistoryInvalid = ({
  recheckCommand,
}: EventHistoryInvalidParameters) =>
  `保留双方历史。检查所选提交的事件边界，仅在获得授权时修复明确的错误，然后重试 ${recheckCommand} --audience agent。`;

export default eventHistoryInvalid;
