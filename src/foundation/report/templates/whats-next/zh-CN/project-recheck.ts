/**
 * @template project-recheck
 * @when project.ready=false
 * 用于报告阻塞 what's next 的项目整备问题之后。
 */
import type { RecheckParameters } from "../contract.ts";

/** @pure */
const projectRecheck = (
  _parameters: RecheckParameters,
) =>
  "目标是在保留无关内容的同时得到有效且完整的项目 snapshot。";

export default projectRecheck;
