/**
 * @template review-presentation
 * @when idea.state=preparing|implementing|deploying
 * Used to describe the exact primary-bound human gate presentation.
 */
import type {
  ReviewPresentationParameters,
  ReviewPresentationText,
} from "../contract.ts";

/** @pure */
const reviewPresentation = ({
  phase,
  reference,
}: ReviewPresentationParameters): ReviewPresentationText => {
  const phaseText = {
    preparing: {
      gateLabel: "Idea acceptance",
      currentContract: "Idea contract",
      decisionQuestion:
        `Do you accept \`${reference}\` as the idea for this IDEA?`,
    },
    implementing: {
      gateLabel: "Implementation acceptance",
      currentContract: "Implementation contract",
      decisionQuestion:
        `Do you accept \`${reference}\` as the implementation for this IDEA?`,
    },
    deploying: {
      gateLabel: "Deployment acceptance",
      currentContract: "Deployment contract",
      decisionQuestion:
        `Do you accept \`${reference}\` as the deployment result for this IDEA?`,
    },
  }[phase];
  return {
    gateLabel: phaseText.gateLabel,
    candidateConnector: "on primary",
    labels: {
      idea: "Idea",
      candidate: "Candidate",
      reviewFocus: "Review focus",
      reviewFiles: "Review files",
      decision: "Decision",
      local: "local",
      remote: "remote",
    },
    documentLabels: {
      "current-contract": phaseText.currentContract,
      ledger: "Execution ledger",
    },
    decisionQuestion: phaseText.decisionQuestion,
  };
};

export default reviewPresentation;
