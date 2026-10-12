import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assembleProfessionalModel, ConfigurationError, TargetError,
} from "../../src/professional-model/index.ts";
import type { CheckRegistry, CheckResult, UseState } from "../../src/professional-model/index.ts";

const source = `
target:
  project: string
  enabled: optional-boolean
  count: optional-number
levels:
  - {level: 0, description: Unavailable}
  - {level: 1, description: Ready}
  - {level: 2, description: Complete}
checks: [[first, second], [last]]
skills:
  repair: "Repair the observed problem, then reobserve."
  unknown: "Unknown problem code; investigate the missing professional guidance."
guidance: {blocked: repair}
unknown: unknown
`;
const pass: CheckResult = { passed: true };
const fail: CheckResult = {
  passed: false,
  problems: [{ code: "blocked", description: "The exact candidate is unavailable." }],
};
const target = { project: "fixture" };

test("executes ordered checks, stops at first failure and upgrades only complete groups", async () => {
  const calls: string[] = [];
  let failed = "second";
  const model = assembleProfessionalModel(source, () => Object.fromEntries(
    ["first", "second", "last"].map((name) => [name, async (received) => {
      assert.equal(received, target);
      calls.push(name);
      return name === failed ? fail : pass;
    }]),
  ) satisfies CheckRegistry);
  assert.deepEqual(await model.observe(target), { level: 0, problems: fail.problems });
  assert.deepEqual(calls, ["first", "second"]);
  calls.length = 0;
  failed = "last";
  assert.deepEqual(await model.observe(target), { level: 1, problems: fail.problems });
  assert.deepEqual(calls, ["first", "second", "last"]);
  calls.length = 0;
  failed = "";
  assert.deepEqual(await model.observe(target), { level: 2, problems: [] });
  assert.deepEqual(calls, ["first", "second", "last"]);
  assert.deepEqual(model.describe().map(({ level }) => level), [0, 1, 2]);
  assert.ok(Object.isFrozen(model.describe()));
  assert.ok(Object.isFrozen(model.describe()[0]));
});

test("supports empty groups and a sole zero fallback level", async () => {
  const empty = assembleProfessionalModel(source.replace("[[first, second], [last]]", "[[], []]"), () => ({}));
  assert.deepEqual(await empty.observe(target), { level: 2, problems: [] });
  const zero = assembleProfessionalModel(source
    .replace("  - {level: 1, description: Ready}\n  - {level: 2, description: Complete}\n", "")
    .replace("[[first, second], [last]]", "[]"), () => ({}));
  assert.deepEqual(await zero.observe(target), { level: 0, problems: [] });
});

test("guide returns inert skill content and explicitly handles all unknown codes", () => {
  const model = assembleProfessionalModel(source, () => ({}));
  assert.match(model.guide("blocked"), /^Repair/);
  for (const code of ["missing", "", "__proto__", "constructor"]) {
    assert.match(model.guide(code), /^Unknown problem code/);
  }
});

test("rejects malformed declarations, invalid levels and stale skill references", () => {
  for (const invalid of [
    source.replace("level: 0", "level: -1"),
    source.replace("level: 1", "level: 1.5"),
    source.replace("level: 1", "level: 0"),
    source.replace("level: 2", "level: 3"),
    source.replace("description: Ready", 'description: ""'),
    source.replace("[[first, second], [last]]", "[[first]]"),
    source.replace("[[first, second], [last]]", "[[12], [last]]"),
    source.replace("project: string", "project: object"),
    source.replace("blocked: repair", "blocked: missing"),
    source.replace("unknown: unknown", "unknown: missing"),
    `${source}\nscript: execute-anything`,
    source.replace("levels:\n", "levels: []\nunused:\n"),
  ]) {
    assert.throws(() => assembleProfessionalModel(invalid, () => ({})), ConfigurationError);
  }
  assert.throws(() => assembleProfessionalModel("levels: [", () => ({})), ConfigurationError);
  assert.throws(() => assembleProfessionalModel(source.replace(
    /levels:\n(?:  - .*\n)+/, "levels: []\n",
  ), () => ({})), /levels must be non-empty/);
});

test("validates every registered check before running any check", async () => {
  let calls = 0;
  const model = assembleProfessionalModel(source, () => ({
    first: async () => { calls += 1; return pass; },
    second: async () => pass,
  }));
  await assert.rejects(model.observe(target), /Unknown registered check: last/);
  assert.equal(calls, 0);
});

test("invalid target fields are distinct from business problems and run no checks", async () => {
  let registrations = 0;
  const model = assembleProfessionalModel(source, () => { registrations += 1; return {}; });
  for (const invalid of [
    {}, { project: 12 }, { project: "fixture", enabled: "yes" },
    { project: "fixture", count: Infinity }, { project: "fixture", count: NaN },
  ]) {
    await assert.rejects(model.observe(invalid), TargetError);
  }
  await assert.rejects(Reflect.apply(model.observe, model, [[]]), TargetError);
  assert.equal(registrations, 0);
});

test("rejects malformed check results instead of returning success-shaped fallbacks", async () => {
  for (const invalid of [
    null, {}, { passed: "true" }, { passed: true, problems: [] }, { passed: false, problems: [] },
    { passed: false, problems: [{ code: "", description: "reason" }] },
    { passed: false, problems: [{ code: "blocked", description: " " }] },
    { passed: false, problems: [{ description: "missing code" }] },
  ]) {
    const model = assembleProfessionalModel(source, () => ({
      first: async () => invalid as CheckResult,
      second: async () => pass,
      last: async () => pass,
    }));
    await assert.rejects(model.observe(target), TypeError);
  }
});

test("injected useState shares latest values after await and isolates sequential and concurrent observations", async () => {
  let observations = 0;
  const samples: number[] = [];
  const model = assembleProfessionalModel(source, (useState) => {
    observations += 1;
    const observation = observations;
    const [getState, setState] = useState(0);
    const [getLabel, setLabel] = useState<string | undefined>(undefined);
    return {
      first: async () => {
        assert.equal(getState(), 0);
        assert.equal(getLabel(), undefined);
        await Promise.resolve();
        setState(getState() + 1);
        setLabel(`observation-${observation}`);
        return pass;
      },
      second: async () => {
        assert.equal(getState(), 1);
        assert.equal(getLabel(), `observation-${observation}`);
        await Promise.resolve();
        setState(getState() + 1);
        return pass;
      },
      last: async () => {
        assert.equal(getState(), 2);
        assert.equal(getLabel(), `observation-${observation}`);
        samples.push(observation);
        return pass;
      },
    };
  });
  await model.observe(target);
  await model.observe(target);
  await Promise.all([model.observe(target), model.observe(target)]);
  assert.equal(observations, 4);
  assert.deepEqual(samples.sort(), [1, 2, 3, 4]);
});

test("useState allocates independent handles and stores direct values without React rerenders", async () => {
  let registrations = 0;
  const value = () => "a stored function, not an initializer";
  const model = assembleProfessionalModel(source, (useState) => {
    registrations += 1;
    const [getLeft, setLeft] = useState(0);
    const [getRight] = useState(0);
    const [getValue, setValue] = useState(value);
    return {
      first: async () => {
        setLeft(7);
        setLeft(getLeft() + 1);
        assert.equal(getLeft(), 8);
        assert.equal(getRight(), 0);
        assert.equal(getValue(), value);
        const next = () => "updated direct function";
        setValue(next);
        assert.equal(getValue(), next);
        return pass;
      },
      second: async () => {
        assert.equal(getLeft(), 8);
        assert.equal(getRight(), 0);
        assert.equal(getValue()(), "updated direct function");
        return pass;
      },
      last: async () => pass,
    };
  });
  await model.observe(target);
  assert.equal(registrations, 1);
});

test("registration-only useState rejects late allocation even after a failed registry factory", async () => {
  let retained: UseState | undefined;
  const model = assembleProfessionalModel(source, (useState) => {
    retained = useState;
    return {
      first: async () => { useState(0); return pass; },
      second: async () => pass,
      last: async () => pass,
    };
  });
  await assert.rejects(model.observe(target), /during check registration/);
  assert.ok(retained);
  assert.throws(() => retained?.(0), /during check registration/);
  const bug = new Error("registry defect");
  const failed = assembleProfessionalModel(source, (useState) => {
    retained = useState;
    throw bug;
  });
  await assert.rejects(failed.observe(target), (caught) => caught === bug);
  assert.throws(() => retained?.(0), /during check registration/);
});

test("failed observations cannot carry useState values into the next observation", async () => {
  let failFirst = true;
  const model = assembleProfessionalModel(source, (useState) => {
    const [getState, setState] = useState(0);
    return {
      first: async () => {
        assert.equal(getState(), 0);
        setState(5);
        return failFirst ? fail : pass;
      },
      second: async () => { assert.equal(getState(), 5); return pass; },
      last: async () => pass,
    };
  });
  assert.equal((await model.observe(target)).level, 0);
  failFirst = false;
  assert.equal((await model.observe(target)).level, 2);
});

test("preserves multiple explicit problems and propagates programmer defects unchanged", async () => {
  const problems = [...fail.problems, { code: "another", description: "Further evidence is missing." }];
  const failure = assembleProfessionalModel(source, () => ({
    first: async () => ({ passed: false, problems: [problems[0]!, problems[1]!] }),
    second: async () => pass,
    last: async () => pass,
  }));
  assert.deepEqual((await failure.observe(target)).problems, problems);
  const bug = new Error("program defect");
  const model = assembleProfessionalModel(source, () => ({
    first: async () => { throw bug; },
    second: async () => pass,
    last: async () => pass,
  }));
  await assert.rejects(model.observe(target), (caught) => caught === bug);
});
