/**
 * @template lifecycle-inactive
 * @when idea.state=abandoned|completed
 * 用于已选择 idea 必须获得新人工决定才能继续时。
 */
import type { LifecycleInactiveParameters } from "../contract.ts";

/** @pure */
const lifecycleInactive = ({
  name,
  state,
}: LifecycleInactiveParameters) =>
  [
    `复查 ${name}（${state}），保留已有决定。`,
    `只有明确人工决定才通过 idea.resumed 恢复；`,
    `需求变化应修改对应世界内容。`,
  ].join("");

export default lifecycleInactive;
