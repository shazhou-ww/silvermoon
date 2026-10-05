import { traceAsync } from "../../foundation/trace/index.js";
import { assessRepositoryReadinessWith } from "./assess-repository-readiness-with.js";

export async function assessIdeaCreationReadiness(options) {
  return traceAsync(
    "repository.assess-creation-readiness",
    {},
    () => assessRepositoryReadinessWith({
      ...options,
      synchronizePrimary: false,
    }),
  );
}
