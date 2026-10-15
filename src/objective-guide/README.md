# Objective Guide

Language-neutral, URI-keyed Objective definitions bind immutable JSON subjects
and one explicit content language into observable instances. This module is a
compatibility facade over `@potential-guide/objective-guide` `0.2.0-rc.1`; the
published package owns Manifest/domain validation, prerequisite projections,
References, check execution and probe workspaces. Only legacy observation
shape, wrapped Guide/instance identity and guarded Reference metadata remain
here. It does not own command reports or Git workflow policy.

Manifest levels declare check nodes and the Problem IDs each check may return.
The package validates that every declared level, check, and Problem has its
localized Reference pages, rejects orphan pages, and rejects undeclared
runtime Problems.

`createObjectiveLoader` uses file resources and executable checks by default.
Virtual URI schemes may explicitly provide resource and check-runner transport
adapters. Loader failures reject, expected instance creation failures are typed
results, and asynchronous probe defects propagate. No regulator, autonomous
loop or portfolio supervisor is included. Scheduling is fixed to concurrency
one. Failed peers in a level aggregate in declaration order, with first-failure
provenance isolated per probe, including overlapping calls on one instance.
