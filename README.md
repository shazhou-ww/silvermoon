<!-- markdownlint-disable-file MD041 -->

<p align="center">
  <!-- markdownlint-disable-next-line MD013 -->
  <img src="./assets/silvermoon.svg" width="960" alt="Silvermoon, the artifact spirit of the project">
</p>

<p align="center">
  <!-- markdownlint-disable-next-line MD013 -->
  <a href="https://npmx.dev/package/silvermoon"><img src="https://img.shields.io/npm/v/silvermoon?style=flat-square" alt="npm version"></a>
  <!-- markdownlint-disable-next-line MD013 -->
  <a href="https://npmx.dev/package/silvermoon"><img src="https://img.shields.io/node/v/silvermoon?style=flat-square" alt="Node.js version"></a>
  <!-- markdownlint-disable-next-line MD013 -->
  <a href="https://npmx.dev/package/silvermoon"><img src="https://img.shields.io/npm/dm/silvermoon?style=flat-square" alt="monthly npm downloads"></a>
  <!-- markdownlint-disable-next-line MD013 -->
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/shazhou-ww/silvermoon?style=flat-square" alt="MIT license"></a>
</p>

<p align="center">
  English | <a href="./README.zh-CN.md">简体中文</a>
</p>

# Silvermoon

> Fellow cultivator, you wouldn't want your lifebound project to be without an
> artifact spirit, would you?

## Quick Start

### Setup

Silvermoon requires Node.js 22 or later, along with Git access to the
repository's primary branch.

From the project directory, send this prompt to your coding agent:

```text
In this project, run:
`silvermoon whats-next --audience agent`

Follow its highest-priority instruction and preserve existing work.
After each observable change, run it again until it reports: `navigation-ready`
```

### Talk to Silvermoon

Use the Silvermoon skill in your coding agent:

```text
/silvermoon
What should I work on next in this project?
```

Or continue an idea directly:

```text
/silvermoon
Continue working on `<idea-alias>` in this project.
Follow the `whats-next` guidance.
Keep going until you need a decision from me.
```

Or start a new idea:

```text
/silvermoon
I have an idea:
Add an optional cultivation-style copy mode,
independent of the selected language.
```

Or run Silvermoon straight from a terminal:

```sh
silvermoon whats-next
silvermoon whats-next <ULID-or-alias>
silvermoon create-idea
silvermoon list-ideas
```

> **Note:** Install and update one global Silvermoon runtime for the device or
> Agent host. Dialogue commands report cached latest-runtime and personal-skill
> health as device advisories. Target repositories do not pin Silvermoon or
> store its skill. Since `0.4.0`, project compatibility is determined by the
> runtime-owned per-file schema capability and migration graph.

For workflows, see [Operating Silvermoon](./docs/operations.md); for command
details, see the [Technical Reference](./docs/reference.md).

## Why Silvermoon

Long-running Agent work tends to make people carry too much invisible state.
Someone has to remember what was originally intended, whether the code still
matches the task, and which conversation or machine holds the latest truth.
Silvermoon moves those concerns into the project itself.

It lets people step away from continuous supervision and return only for the
decisions that are theirs: approving the intended outcome, accepting the
implementation, and accepting that the result holds in the outside world.
Between those boundaries, an Agent can inspect repository facts and carry on
with the highest-priority safe action.

It also refuses to let a detached task card declare success. State is derived
jointly from current artifacts and explicit decisions, so once a goal or an
implementation changes, conclusions that rested on the older revision are
invalidated as a matter of course. And because those facts live in Git, work
continues across devices, sessions, Agents, and hosting platforms.

## The Project's Artifact Spirit

<table>
  <tr>
    <td width="160" align="center" valign="top">
      <!-- markdownlint-disable-next-line MD013 -->
      <img src="./assets/silvermoon-mascot.png" width="160" alt="Full-body portrait of Silvermoon, the project's artifact spirit">
    </td>
    <td valign="top">
      Silvermoon is named after a character in <em>A Record of a Mortal's
      Journey to Immortality</em>. She comes from the Silvermoon Wolf Clan in
      the Spirit Realm, and is one of the two souls split from Ling Long.
      Adrift in the human realm, she became the artifact spirit of a
      wolf-headed jade scepter — and in that long service lost part of her
      memory, taking the name Silvermoon. She later became the artifact spirit
      of Han Li's Bamboo Cloudswarm Swords.
      <br><br>
      That image suits this project: Silvermoon belongs to no single operator
      and no single chat. It lives alongside the project's artifacts,
      understands their state, and helps every companion see what comes next.
      The backstory is inspiration, not a prerequisite for using the tool.
    </td>
  </tr>
</table>

Watch *A Record of a Mortal's Journey to Immortality*:

<!-- markdownlint-disable-next-line MD013 -->
- YouTube: [Episode 150: Overseas Turmoil 26](https://www.youtube.com/watch?v=GJgezoCBIHM "A Record of a Mortal's Journey to Immortality — Episode 150: Overseas Turmoil 26")
<!-- markdownlint-disable-next-line MD013 -->
- Bilibili: [Episode 150: Overseas Turmoil 26](https://www.bilibili.com/bangumi/play/ep1231558 "A Record of a Mortal's Journey to Immortality — Episode 150: Overseas Turmoil 26")

## From Ideal to Real

A project is more than a task list or a transcript. It is an ideal becoming
real across three nested worlds.

**Ideal World (道心)** is the world of ideals, **Inner World (内景)** the
subjective world, and **Outer World (现世)** the world of reality.

> 道心立志，内景化形，现世求真。

The worlds nest from the inside out: the subjective world contains the ideal it
serves, and is itself part of the real world — just as a person holds ideals yet
must live in reality.

So the ideal is first argued out in the Ideal World, then given form in the
Inner World, and finally deployed into the Outer World. That is consciousness
acting back upon matter.

Humans own approval and acceptance. Agents own continuation: they read the
contracts, the ledger, and the facts in Git; preserve concurrent work; carry
out one safe action; and re-observe only once something has changed. Context
belongs to the project, not to a fleeting conversation.

## Further Reading

- [Getting Started](./docs/getting-started.md) — installation, configuration,
  and the first idea.
- [Core Concepts](./docs/core-concepts.md) — project ownership, the three
  worlds, revisions, and decision boundaries.
- [Operating Silvermoon](./docs/operations.md) — navigation, creation,
  publication, hygiene, and continuation.
- [Technical Reference](./docs/reference.md) — storage, derived state, CLI
  reports, validation targets, and schemas.
- [Maintaining Silvermoon](./docs/maintaining.md) — development checks,
  documentation ownership, and release guidance.

## Community

- [Contributing](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)
- [Support](./SUPPORT.md)
- [Changelog](./CHANGELOG.md)
- [MIT License](./LICENSE)

## Image Copyright Disclaimer

The Silvermoon character images in this project are AI-generated derivative
works based on the animated adaptation of *A Record of a Mortal's Journey to
Immortality*. Rights in the original character and animation belong to their
respective holders, and these images fall outside this project's
[MIT License](./LICENSE). If any rights holder believes an image infringes
their rights, please contact the author and the image will be replaced.
