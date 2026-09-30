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
  <a href="https://npmx.dev/package/silvermoon"><img src="https://img.shields.io/npm/unpacked-size/silvermoon?style=flat-square" alt="npm unpacked size"></a>
  <!-- markdownlint-disable-next-line MD013 -->
  <a href="https://github.com/shazhou-ww/silvermoon/actions/workflows/ci.yml?query=branch%3Amain"><img src="https://img.shields.io/github/actions/workflow/status/shazhou-ww/silvermoon/ci.yml?branch=main&style=flat-square&label=CI" alt="CI status"></a>
</p>

<p align="center">
  English | <a href="./README.zh-CN.md">简体中文</a>
</p>

# Silvermoon

> Fellow cultivator, you wouldn't want your lifebound project to be without an
> artifact spirit, would you?

## Quick Start

### Setup

Silvermoon needs Node.js 22 or newer and Git access to the repository's primary
branch.

Send this prompt to your coding agent from the project:

```text
In this project, run:
`npx silvermoon whats-next --audience agent`

Follow its highest-priority instruction and preserve existing work.
After each observable change, run it again until it reports:
`navigation-ready`
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
Add an optional cultivation-style copy mode, independent of the selected
language.
```

Or use Silvermoon directly in a terminal:

```sh
npx silvermoon whats-next
npx silvermoon whats-next <ULID-or-alias>
npx silvermoon create-idea
npx silvermoon list-ideas
```

> **Note:** We recommend `npx silvermoon` over a global install. It avoids
> maintaining a separate global version; in Node.js projects, the lockfile keeps
> the project-installed version consistent.

See [Operating Silvermoon](./docs/operations.md) for workflows and the
[Technical Reference](./docs/reference.md) for command details.

## Why Silvermoon

Long-running Agent work usually asks people to carry too much invisible state.
Someone must remember what was intended, whether the code still matches the
task, and which conversation or machine knows the latest truth. Silvermoon
makes those concerns part of the project instead.

It lets people step back from continuous supervision and return at the
decisions that belong to them: approving the intended outcome, accepting the
implementation, and accepting that the result is true in the outside world.
Between those boundaries, an Agent can inspect repository facts and continue
the highest-priority safe action.

It also refuses to let a detached task card declare success. Current artifacts
and explicit decisions jointly determine state, so a changed goal or
implementation naturally invalidates conclusions that depended on the older
revision. Because those facts live in Git, work can continue across devices,
sessions, Agents, and hosting platforms.

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
      the Spirit Realm and is one of the split souls of Ling Long. After losing
      part of her memory in the human realm, she lives as an artifact spirit
      first in a wolf-headed jade scepter and later in Han Li's Bamboo
      Cloudswarm Swords.
      <br><br>
      That image fits this project: Silvermoon does not belong to one operator
      or one chat. It lives with the project's artifacts, understands their
      state, and helps each companion find what comes next. The biography is
      inspiration, not a prerequisite for using the tool.
    </td>
  </tr>
</table>

Watch *A Record of a Mortal's Journey to Immortality*:

<!-- markdownlint-disable-next-line MD013 -->
- YouTube: [Episode 150: Overseas Turmoil 26](https://www.youtube.com/watch?v=GJgezoCBIHM "A Record of a Mortal's Journey to Immortality — Episode 150: Overseas Turmoil 26")
<!-- markdownlint-disable-next-line MD013 -->
- Bilibili: [Episode 150: Overseas Turmoil 26](https://www.bilibili.com/bangumi/play/ep1231558 "A Record of a Mortal's Journey to Immortality — Episode 150: Overseas Turmoil 26")

## From Ideal To Real

A project is more than a task list or a transcript. It is an ideal becoming
real through three nested worlds.

**Ideal World (道心)** names the outcome worth pursuing. **Inner World (内景)**
gives that intent shape in repository artifacts. **Outer World (现世)** asks
whether the shaped work is true where it must actually operate.

> 道心立意，内景成形，现世验真。

The worlds nest from the inside out. Implementation contains the ideal it
serves, and deployment contains both. This is an engineering relationship, not
just a metaphor: when an inner world changes, conclusions from an outer world
no longer have the same foundation and must be proven again.

Humans own approval and acceptance. Agents own continuation: they read the
contracts, the ledger, and Git facts; preserve concurrent work; execute one
safe action; and reobserve only after something changes. The context belongs to
the project, not to a fleeting conversation.

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
