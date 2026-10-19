/**
 * @template lifecycle-implementing
 * @when idea.state=implementing
 * 用于 acceptInner 前继续推进实现工作时。
 */
import type { LifecycleImplementingParameters } from "../contract.ts";

/** @pure */
const lifecycleImplementing = ({
  action,
  documentPath,
  eventDigest,
  ideaId,
  idealDocumentPath,
  ledgerPath,
  name,
  primaryCommit,
  submitAction,
  worldPath,
}: LifecycleImplementingParameters) =>
  [
    `目标是为 idea \`${name}\` 的准确当前 revision 完成实现证据，`,
    `并在提交前让该 revision 成为 primary 上的当前版本。`,
    `可工作的范围包括阶段文件 \`${documentPath}\`、`,
    `\`${worldPath}\` 下的相关辅助文件和 ledger \`${ledgerPath}\`。`,
    `除非要求本身必须变化，否则保持 canonical idea 文件 \`${idealDocumentPath}\` 不变。`,
    `证据就绪后，一种可选提交路径是先把 revision 同步到 primary，`,
    `再用 \`silvermoon event append ${ideaId}`,
    ` --expected-digest ${eventDigest ?? "<event-digest>"}`,
    ` --expected-primary ${primaryCommit} --format markdown\``,
    ` 为准确的当前 revision 记录 ${submitAction}；`,
    `无需 replay cursor 或 expected length。`,
    `在该 Submit 对当前 revision 生效前，${action} gate 仍不可用，`,
    `events.jsonl 必须通过 command surface 保持 append-only。`,
  ].join("");

export default lifecycleImplementing;
