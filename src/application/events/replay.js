import { localPrimary } from "../../events/index.js";
import { EventStream } from "../../events/index.js";
import { IdeaEventFormatError, parseIdeaEvents, replayIdeaEvents } from "../../events/rules/index.js";

export function replayStoredEvents({ root, config, id, store, options, observation }) {
  const { bytes } = store;
  let receipt;

  let reduction = null;
  let format = { ok: true };
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
    baseline = { unavailable: cause.message };
  }
  receipt = { ...observation, outcome: "observed", format, reduction, baseline };

  return receipt;
}
