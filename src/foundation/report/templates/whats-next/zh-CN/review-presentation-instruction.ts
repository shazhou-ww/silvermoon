/**
 * @template review-presentation-instruction
 * @when idea.review.available=true
 * 用于已选择的 active idea 具有绑定 primary 的审阅候选时。
 */

/** @pure */
export default function reviewPresentationInstruction() {
  return "到达人工门时，把由 response.review.presentation 渲染的 fenced 审阅模板作为一条独立且完整的 assistant 消息发送。仅替换其中的花括号占位值和链接目标，并严格遵循模板的本地化指示。不要在同一 turn 打开交互决定。";
}
