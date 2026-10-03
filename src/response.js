import { renderMarkdownResponse } from "./markdown.js";

export { respond } from "./response-projection.js";

export function renderResponse(response, { now = new Date() } = {}) {
  const items = response.kind === "idea-list" ? response.items : response.choices ?? [];
  const timestamps = [
    ...items.map(({ createdAt }) => createdAt),
    ...(response.kind === "idea-list"
      ? [response.query?.createdSince, response.query?.createdBefore] : []),
  ].filter((value) => value !== undefined && value !== null);
  const dateFacts = new Map(timestamps.map((timestamp) => {
    const date = new Date(timestamp);
    return [timestamp, {
      milliseconds: date.getTime(),
      localDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    }];
  }));
  return renderMarkdownResponse(response, { now, dateFacts });
}
