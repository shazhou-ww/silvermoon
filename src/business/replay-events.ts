import { localPrimary } from "../foundation/event-history/index.ts";
import { EventStream } from "../foundation/event-store/index.ts";
import { IdeaEventFormatError, parseIdeaEvents, replayIdeaEvents } from "../foundation/event-codec/index.ts";
import type { EventOptions, EventStore, ProjectConfig } from "./shared/business-types.ts";
import { errorMessage } from "./shared/business-types.ts";

export function replayStoredEvents({
  root, config, id, store, options, observation,
}: {
  root: string;
  config: ProjectConfig;
  id: string;
  store: EventStore;
  options: EventOptions;
  observation: Record<string, unknown>;
}) {
  const { bytes } = store;
  let receipt;

  let reduction = null;
  let format: { ok: boolean; error?: string } = { ok: true };
  try {
    if (store.storage === "segmented") EventStream.fromSegments(store.entries, options);
    reduction = replayIdeaEvents(id, parseIdeaEvents(bytes, options), options);
  }
  catch (error) {
    if (!(error instanceof IdeaEventFormatError)) throw error;
    format = { ok: false, error: error.message };
  }
  let baseline;
  try {
    baseline = localPrimary(root, config);
  } catch (cause) {
    baseline = { unavailable: errorMessage(cause) };
  }
  receipt = { ...observation, outcome: "observed", format, reduction, baseline };

  return receipt;
}
