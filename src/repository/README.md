# Repository infrastructure

Provide Git commands, immutable snapshot readers, filesystem state transactions,
authenticated disposable caches and subprocess execution through [index.js](./index.js).

Use command trace capabilities and concrete sibling infrastructure internally.
Keep fetching explicit and preserve batch/incremental I/O, exact sources and
unknown-work protection.

Do not decide lifecycle state or human authorization. Recovery must remain explicit,
owned and guarded; caches are not repository authority.
