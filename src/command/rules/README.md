# Command-message rules

Reduce ordered messages, validate invariants and project the four-part report.
[index.js](./index.js) exports pure command rules independently of runtime/trace.

Use only pure response and standard-library capabilities. Explicit inputs
determine transitions and failures; caller-owned objects are not frozen/mutated.

Do not access I/O, infer decisions, or combine this stream with persistent events.
