# Usage

The normal loop is:

1. Find a desktop or browser root.
2. Observe that root and retain its `stateId`.
3. Search, expand, or inspect that immutable state.
4. Act using the same `stateId` and its `@e` refs.

## Tools

| Tool | Purpose |
| --- | --- |
| `find_roots` | Find desktop and CDP browser-page roots. |
| `observe_ui` | Capture one root and return a folded outline plus `stateId`. |
| `search_ui` | Search the full cached outline. |
| `expand_ui` | Show local outline context for one ref. |
| `inspect_ui` | Show fields, rects, actions, and evidence for one ref. |
| `act_ui` | Perform one checked action transaction and return one final state. |
| `read_text` | Page through long text owned by a state. |
| `wait_for` | Wait for text or a role to appear or disappear. |
| `launch_browser` | Start a managed CDP browser and return page roots. |
| `navigate_browser` | Navigate the browser page owned by a state. |
| `evaluate_browser` | Evaluate JavaScript in the browser page owned by a state. |

## Refs and state

`find_roots` returns roots such as `@r1`. Every desktop window, transient surface, and CDP page participates in that same forest. `observe_ui` returns element refs such as `@e12` and a `stateId`.

Every tool that consumes an `@e` ref also requires its owning `stateId`. A state remains queryable while it is in the bounded store, but a mutation from an old resource epoch is rejected as stale. Observe again after another mutation, an uncertain action outcome, or state eviction.

Nodes marked `pictureOnly` have visual evidence but no platform accessibility element. Semantic actions cannot target them. Coordinate actions are available only from a current image-bearing desktop state.

## Progressive disclosure

Use `observe_ui({ root: "@r1" })` for the compact first view. Then query without another capture:

```ts
search_ui({ stateId, text: "Save" })
expand_ui({ stateId, ref: "@e7", depth: 3 })
inspect_ui({ stateId, ref: "@e12" })
```

`semantic` observation is cheapest, `fused` is the default, and `visual` forces visual text evidence. Search can escalate OCR once when the original desktop look omitted it; that refresh is checked against the state's resource epoch.

## Acting and batching

The public action shape is always transactional:

```ts
act_ui({ stateId, actions: [{ action: "press", ref: "@e12" }] })
```

When an action has an observable completion signal, attach it to the same
transaction. Pi waits through the platform change-notification path and marks
the execution `didnt` with `postcondition_failed` if the application swallowed
the delivered event:

```js
act_ui({
  stateId,
  headless: true,
  actions: [{ action: "press", ref: "@e12" }],
  expect: { text: "Archive completed", timeoutMs: 3000 }
})
```

Verification reports `verified`, `preexisting`, or `failed`. A preexisting
condition means the requested end state holds, but is not evidence that the
action caused it.

Batch steps only when the second step does not need to inspect the result of the first:

```ts
act_ui({
  stateId,
  actions: [
    { action: "setText", ref: "@e18", text: "hello" },
    { action: "press", ref: "@e22" },
  ],
})
```

Steps run sequentially against one resource and retain helper checks. The native helper uses one root baseline and final settle for the transaction, and the bridge returns one final observation. If a transition can change the meaning of later refs or requires a decision, send one action, inspect the returned state, then continue.

Coordinate fallback uses image pixels from the observed state:

```ts
act_ui({ stateId, actions: [{ action: "click", x: 420, y: 300 }] })
```

## Browser use

Browser pages use the same roots, states, and element refs:

```ts
launch_browser({ browser: "helium", url: "https://example.com" })
find_roots({ kind: "browser_page" })
observe_ui({ root: "@r3" })
act_ui({ stateId, actions: [{ action: "press", ref: "@e7" }] })
navigate_browser({ stateId: returnedStateId, url: "https://openai.com" })
```

`read_text`, `wait_for`, and `evaluate_browser` also need only the browser observation's `stateId`; there is no public `contextId` or separate snapshot flow.

## Parallel calls

Pi may issue tool calls concurrently. Cached queries can overlap freely. Live work for different desktop processes or CDP pages can overlap; work for the same physical resource is ordered. Do not intentionally race two mutations derived from the same state: one wins and the other receives a stale-state error by design.
