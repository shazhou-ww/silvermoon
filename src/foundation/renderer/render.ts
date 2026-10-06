import { renderMarkdownResponse } from "./markdown.ts";
import type {
  DateFacts,
  IdeaInventoryItem,
  ReportResponse,
} from "../report/types.ts";

export { respond } from "../report/index.ts";

export function renderResponse(
  response: ReportResponse,
  { now = new Date() }: { now?: Date } = {},
) {
  const items: IdeaInventoryItem[] = response.kind === "idea-list"
    ? response.items
    : response.kind === "choice-required"
      ? response.choices
      : [];
  const timestamps = [
    ...items.map(({ createdAt }) => createdAt),
    ...(response.kind === "idea-list"
      ? [response.query?.createdSince, response.query?.createdBefore] : []),
  ].filter((value) => value !== undefined && value !== null);
  const dateFacts = new Map<string, DateFacts>(timestamps.map((timestamp) => {
    const date = new Date(timestamp);
    return [timestamp, {
      milliseconds: date.getTime(),
      localDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    }];
  }));
  return renderMarkdownResponse(response, { now, dateFacts });
}
