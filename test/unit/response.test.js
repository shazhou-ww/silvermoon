import assert from "node:assert/strict";
import { test } from "node:test";

import { renderResponse } from "../../src/presentation/render.js";

const now = new Date("2026-09-30T12:00:00.000Z");
const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

function idea(age, alias, title) {
  return {
    id: `ID-${age}`,
    state: "preparing",
    createdAt: new Date(now.getTime() - age).toISOString(),
    ...(alias === undefined ? {} : { alias }),
    ...(title === undefined ? {} : { title }),
  };
}

function inventory(items, language = "zh-CN") {
  return {
    kind: "idea-list",
    language,
    summary: "Matched ideas.",
    inventory: { counts: { preparing: items.length } },
    items,
  };
}

test("inventory counts omit zero states and use localized punctuation", () => {
  const counts = {
    preparing: 2,
    implementing: 1,
    deploying: 1,
    completed: 0,
    abandoned: 0,
  };
  const chinese = renderResponse({
    ...inventory([]),
    summary: "匹配 4 个 idea，返回 4 个。",
    inventory: { counts },
  }, { now });
  const english = renderResponse({
    ...inventory([], "en-US"),
    summary: "Matched 4 idea(s) and returned 4.",
    inventory: { counts },
  }, { now });

  assert.match(
    chinese,
    /匹配 4 个 idea，返回 4 个。计数：preparing=2，implementing=1，deploying=1。/,
  );
  assert.match(
    english,
    /Matched 4 idea\(s\) and returned 4\. Counts: preparing=2, implementing=1, deploying=1\./,
  );
  assert.doesNotMatch(chinese, /completed|abandoned/);
  assert.doesNotMatch(english, /completed|abandoned/);

  const empty = renderResponse({
    ...inventory([]),
    summary: "没有匹配的 idea。",
    inventory: {
      counts: Object.fromEntries(Object.keys(counts).map((state) => [state, 0])),
    },
  }, { now });
  assert.doesNotMatch(empty, /计数/);
});

test("text dates use short localized relative durations and local dates only after seven days", () => {
  const ages = [
    0,
    59_999,
    minute,
    32 * minute,
    hour,
    2 * hour,
    day,
    5 * day,
    7 * day,
    7 * day + 1,
    -32 * minute,
    -59_999,
    -8 * day,
  ];
  const items = ages.map((age) => idea(age));
  const chinese = renderResponse(inventory(items), { now });
  const english = renderResponse(inventory(items, "en-US"), { now });
  const chineseDurations = [
    "刚刚", "刚刚", "1分钟前", "32分钟前", "1小时前",
    "2小时前", "1天前", "5天前", "7天前",
  ];
  const englishDurations = [
    "just now", "just now", "1m ago", "32m ago", "1h ago",
    "2h ago", "1d ago", "5d ago", "7d ago",
  ];
  for (const [index, age] of ages.entries()) {
    const localDate = new Date(items[index].createdAt);
    const dateOnly = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;
    const chineseValue = chineseDurations[index]
      ?? (index === 10 ? "32分钟后" : index === 11 ? "马上" : dateOnly);
    const englishValue = englishDurations[index]
      ?? (index === 10 ? "in 32m" : index === 11 ? "soon" : dateOnly);
    if (index === 9) {
      assert.equal(chineseValue, dateOnly);
      assert.equal(englishValue, dateOnly);
    }
    assert.ok(chinese.includes(`| ID-${age} | preparing | ${chineseValue} | - |`));
    assert.ok(english.includes(`| ID-${age} | preparing | ${englishValue} | - |`));
  }
  assert.doesNotMatch(chinese, /T12:00:00\.000Z/);
  assert.deepEqual(items, ages.map((age) => idea(age)));
});

test("navigation and inventory share table columns, alias precedence and Markdown escaping", () => {
  const items = [
    idea(32 * minute, "a|b\\c", "A|B\nnext"),
    idea(5 * day),
  ];
  const list = renderResponse(inventory(items), { now });
  const navigation = renderResponse({
    kind: "choice-required",
    language: "zh-CN",
    summary: "Choose.",
    choices: items,
  }, { now });
  const table = [
    "| Alias / ID | 状态 | 创建时间 | 标题 |",
    "| --- | --- | --- | --- |",
    "| a\\|b\\\\c | preparing | 32分钟前 | A\\|B next |",
    "| ID-432000000 | preparing | 5天前 | - |",
  ].join("\n");
  assert.ok(list.includes(table));
  assert.ok(navigation.includes(`### Active ideas\n\n${table}`));
  assert.doesNotMatch(list, /\| ID-1920000 \|/);
});

test("problems render as an escaped table without changing the report", () => {
  const response = {
    kind: "blocked",
    language: "en-US",
    summary: "Blocked.",
    problems: [
      { type: "bad|type", summary: "A\\B|C\nnext" },
      { type: "other", summary: "Second issue" },
    ],
  };
  const before = structuredClone(response);
  assert.match(
    renderResponse(response),
    /### Issues to address\n\n\| Type \| Summary \|\n\| --- \| --- \|\n\| bad\\\|type \| A\\\\B\\\|C next \|\n\| other \| Second issue \|/,
  );
  assert.deepEqual(response, before);
});

test("invalid structured timestamps fail explicitly", () => {
  assert.throws(
    () => renderResponse(inventory([{ ...idea(0), createdAt: "invalid" }]), { now }),
    /invalid timestamp/,
  );
});

test("rendered query time bounds are relative while normalized UTC facts stay exact", () => {
  const response = {
    ...inventory([idea(5 * day)]),
    query: {
      createdSince: new Date(now.getTime() - 5 * day).toISOString(),
      createdBefore: new Date(now.getTime() - 2 * hour).toISOString(),
    },
  };
  const rendered = renderResponse(response, { now });
  assert.match(rendered, /创建时间下界: 5天前/);
  assert.match(rendered, /创建时间上界: 2小时前/);
  assert.doesNotMatch(rendered, /2026-09-25T12:00:00/);
  assert.equal(response.query.createdSince, "2026-09-25T12:00:00.000Z");
  assert.equal(response.query.createdBefore, "2026-09-30T10:00:00.000Z");
});
