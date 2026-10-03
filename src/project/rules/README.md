# Project parsing and policy

Parse canonical config/YAML, resolve languages, validate repository coordinates
and inspect explicit adoption/guidance content. [index.js](./index.js) exports rules.

Only explicit facts and reviewed deterministic parser/hash capabilities are used.
No project readers, repository commands, package-resource reads or runtime sinks.

Content language and temporary output language remain separate contracts.
