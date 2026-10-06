import { assessRepositoryReadinessWith } from "./assess-repository-readiness-with.ts";
import { traceBusinessAsync } from "./business-types.ts";

export async function assessRepositoryReadiness(
  options: Parameters<typeof assessRepositoryReadinessWith>[0],
) {
  return traceBusinessAsync(
    "repository.assess-readiness",
    {},
    () => assessRepositoryReadinessWith(options),
  );
}
