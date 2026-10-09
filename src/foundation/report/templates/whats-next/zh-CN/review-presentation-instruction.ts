/**
 * @template review-presentation-instruction
 * @when idea.review.available=true
 * 用于已选择的 active idea 具有绑定 primary 的审阅候选时。
 */

/** @pure */
export default function reviewPresentationInstruction() {
  return "到达人工门时，先把报告中的审阅候选作为一条独立且已完成的 assistant 消息呈现，并提供宿主可点击的本地链接与不可变 primary 链接。所有固定 gate 标签、文档标签、primary 连接语和准确决定问题都以 response.review.presentation 为准；requiresLocalization 为 false 时逐字保留这些字符串，为 true 时把所有面向人的呈现字符串本地化为 contentLanguage，同时保留机器标识。仅按报告的紧凑顺序补充 idea 身份、一句审阅重点和选定的审阅链接。不要在同一 turn 打开交互决定；工具界面可能隐藏审阅索引。";
}
