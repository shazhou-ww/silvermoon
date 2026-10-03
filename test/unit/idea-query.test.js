import assert from "node:assert/strict";
import { test } from "node:test";

import {
  extractIdeaTitle,
  ideaCreatedAt,
  ideaInventoryItem,
  normalizeIdeaQuery,
  queryIdeaInventory,
} from "../../src/idea/index.js";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function idAt(timestamp, suffix) {
  let value = BigInt(Date.parse(timestamp));
  let encoded = "";
  for (let index = 0; index < 10; index += 1) {
    encoded = ALPHABET[Number(value % 32n)] + encoded;
    value /= 32n;
  }
  return `${encoded}${suffix.repeat(16)}`;
}

test("normalizes default, repeated, active, and all state selections", () => {
  assert.deepEqual(normalizeIdeaQuery(), {
    states: ["preparing", "implementing", "deploying"],
    query: null,
    createdSince: null,
    createdBefore: null,
    sort: "newest",
    limit: null,
  });
  assert.deepEqual(
    normalizeIdeaQuery({
      states: ["completed", "active", "completed"],
      query: "  Moon  ",
      createdSince: "2026-09-29T08:00:00+08:00",
      createdBefore: "2026-09-30T00:00:00Z",
      sort: "oldest",
      limit: "10",
    }),
    {
      states: ["preparing", "implementing", "deploying", "completed"],
      query: "Moon",
      createdSince: "2026-09-29T00:00:00.000Z",
      createdBefore: "2026-09-30T00:00:00.000Z",
      sort: "oldest",
      limit: 10,
    },
  );
  assert.deepEqual(normalizeIdeaQuery({ all: true }).states, [
    "preparing",
    "implementing",
    "deploying",
    "completed",
    "abandoned",
  ]);
});

test("rejects every invalid query class with usage exit status", () => {
  const invalid = [
    { states: [] },
    { states: [""] },
    { states: ["unknown"] },
    { states: ["active"], all: true },
    { query: "" },
    { query: "   " },
    { createdSince: "2026-09-29" },
    { createdSince: "2026-02-30T00:00:00Z" },
    { createdBefore: "2026-09-29T00:00:00" },
    {
      createdSince: "2026-09-29T00:00:00Z",
      createdBefore: "2026-09-29T00:00:00Z",
    },
    {
      createdSince: "2026-09-30T00:00:00Z",
      createdBefore: "2026-09-29T00:00:00Z",
    },
    { sort: "ascending" },
    { limit: "0" },
    { limit: "-1" },
    { limit: "1.5" },
    { limit: Number.MAX_SAFE_INTEGER + 1 },
  ];
  for (const query of invalid) {
    assert.throws(
      () => normalizeIdeaQuery(query),
      (caught) => caught.exitCode === 2,
      JSON.stringify(query),
    );
  }
});

test("derives UTC creation time and optional title from canonical metadata", () => {
  const id = idAt("2026-09-29T01:02:03.456Z", "A");
  assert.equal(ideaCreatedAt(id), "2026-09-29T01:02:03.456Z");
  assert.equal(
    extractIdeaTitle("Intro\n\n# Query **local** [ideas](https://example.test)\n"),
    "Query local ideas",
  );
  assert.equal(extractIdeaTitle("## Only a secondary heading\n"), undefined);
  assert.deepEqual(
    ideaInventoryItem(
      { id, state: "preparing", alias: "fixture" },
      "Query local ideas",
    ),
    {
      id,
      state: "preparing",
      createdAt: "2026-09-29T01:02:03.456Z",
      alias: "fixture",
      title: "Query local ideas",
    },
  );
});

test("combines filters, stable sorting, counts, and post-sort limits", () => {
  const first = idAt("2026-09-29T00:00:00.000Z", "A");
  const sameMillisecond = idAt("2026-09-29T00:00:00.000Z", "B");
  const later = idAt("2026-09-30T00:00:00.000Z", "C");
  const items = [
    {
      id: first,
      state: "preparing",
      createdAt: ideaCreatedAt(first),
      title: "Alpha plan",
    },
    {
      id: sameMillisecond,
      state: "completed",
      createdAt: ideaCreatedAt(sameMillisecond),
      alias: "alpha-release",
    },
    {
      id: later,
      state: "implementing",
      createdAt: ideaCreatedAt(later),
      title: "Other work",
    },
  ];

  const oldest = queryIdeaInventory(items, {
    states: ["active", "completed"],
    query: "ALPHA",
    createdSince: "2026-09-29T00:00:00Z",
    createdBefore: "2026-09-30T00:00:00Z",
    sort: "oldest",
    limit: 1,
  });
  assert.deepEqual(oldest.ideas.map(({ id }) => id), [first]);
  assert.deepEqual(oldest.summary, {
    matched: 2,
    returned: 1,
    truncated: true,
    counts: {
      preparing: 1,
      implementing: 0,
      deploying: 0,
      completed: 1,
      abandoned: 0,
    },
  });

  const newest = queryIdeaInventory(items.slice(0, 2), {
    states: ["active", "completed"],
  });
  assert.deepEqual(
    newest.ideas.map(({ id }) => id),
    [sameMillisecond, first],
  );
});
