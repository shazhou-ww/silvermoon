# Idea model

Expose lifecycle/query APIs and deterministic scaffold plans through
[index.js](./index.js). [Rules](./rules/README.md) provide the independent pure core.

Public query wrappers snapshot existing default enumeration facts; pure query
functions receive those facts explicitly. Preserve legacy mutable public exports.

Scaffold plans consume explicit IDs/language/version. Reading/writing repositories
and obtaining default time/randomness belong to application/infrastructure.
