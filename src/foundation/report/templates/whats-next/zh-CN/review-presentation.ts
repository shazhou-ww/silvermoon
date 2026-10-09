/**
 * @template review-presentation
 * @when idea.state=preparing|implementing|deploying
 * 用于描述绑定 primary 的准确人工门呈现。
 */
import type {
  ReviewPresentationParameters,
  ReviewPresentationText,
} from "../contract.ts";

/** @pure */
export default function reviewPresentation({
  phase,
  reference,
}: ReviewPresentationParameters): ReviewPresentationText {
  const phaseText = {
    preparing: {
      gateLabel: "构想验收",
      currentContract: "构想契约",
      decisionQuestion: `是否接受 \`${reference}\` 作为该 IDEA 的构想？`,
    },
    implementing: {
      gateLabel: "实现验收",
      currentContract: "实现契约",
      decisionQuestion: `是否接受 \`${reference}\` 作为该 IDEA 的实现？`,
    },
    deploying: {
      gateLabel: "部署验收",
      currentContract: "部署契约",
      decisionQuestion: `是否接受 \`${reference}\` 作为该 IDEA 的部署结果？`,
    },
  }[phase];
  return {
    gateLabel: phaseText.gateLabel,
    candidateConnector: "位于 primary",
    labels: {
      idea: "构想",
      candidate: "候选版本",
      reviewFocus: "审阅重点",
      reviewFiles: "审阅文件",
      decision: "决定",
      local: "本地",
      remote: "线上",
    },
    documentLabels: {
      "current-contract": phaseText.currentContract,
      ledger: "执行清单",
    },
    decisionQuestion: phaseText.decisionQuestion,
  };
}
