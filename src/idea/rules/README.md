# Idea rules

Validate status, derive lifecycle, query inventory, extract titles, encode IDs and
produce templates. [index.js](./index.js) exports the pure model entrypoint.

Use explicit facts and project language/YAML rules. Pure querying does not read
mutable default enumerations implicitly; compatibility wrappers live in the parent.

No filesystem, network, clock, randomness, trace or human-decision inference.
