import { traceAsync } from "../../foundation/trace/index.js";
import { assessRepositoryReadinessWith } from "./assess-repository-readiness-with.js";

export async function assessRepositoryReadiness(options) {
  return traceAsync(
    "repository.assess-readiness",
    {},
    () => assessRepositoryReadinessWith(options),
  );
}
