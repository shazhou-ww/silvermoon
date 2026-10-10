/**
 * @template review-presentation-instruction
 * @when idea.review.available=true
 * 用于已选择的 active idea 具有绑定 primary 的审阅候选时。
 */

/** @pure */
const reviewPresentationInstruction = () =>
  `把 fenced 审阅模板作为一条独立的 assistant 消息发送后结束当前 turn；不要在同一 turn 打开交互决定。`;

export default reviewPresentationInstruction;
