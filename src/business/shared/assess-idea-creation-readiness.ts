import { assessRepositoryReadinessWith } from "./assess-repository-readiness-with.ts";
import { traceBusinessAsync } from "./business-types.ts";

export async function assessIdeaCreationReadiness(
  options: Parameters<typeof assessRepositoryReadinessWith>[0],
) {
  return traceBusinessAsync(
    "repository.assess-creation-readiness",
    {},
    () => assessRepositoryReadinessWith({
      ...options,
      synchronizePrimary: false,
    }),
  );
}
