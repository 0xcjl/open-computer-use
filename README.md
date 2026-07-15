# open-computer-use

`open-computer-use` is a standalone, policy-gated Computer Use runtime for macOS. It exposes the full state-scoped desktop and managed-browser workflow through a TypeScript SDK, the `ocu` CLI, and a local stdio MCP server.

It is a fork of [`injaneity/pi-computer-use`](https://github.com/injaneity/pi-computer-use) at `230d2e2c364ee76c0b7492a0588353f2fd064b67`. The original MIT license and attribution are retained in [LICENSE](./LICENSE) and [NOTICE](./NOTICE). This project removes the Pi extension package as the required host; it is not affiliated with Pi.

## Capability surface

The MCP server provides eleven state-scoped tools:

`find_roots`, `observe_ui`, `search_ui`, `expand_ui`, `inspect_ui`, `read_text`, `wait_for`, `act_ui`, `launch_browser`, `navigate_browser`, and `evaluate_browser`.

Every mutable operation consumes the exact `stateId` that produced its element refs. Immutable observations, resource epochs, per-resource scheduling, transactions, checked outcomes, and successor-state diffs are inherited from the upstream runtime.

## Install

```bash
npm install -g @0xcjl/open-computer-use
ocu config init
ocu install --host hermes # or: ocu install --host openclaw
ocu doctor
```

`ocu config init` creates a deny-by-default configuration at `~/.config/open-computer-use/config.json`. Add an explicit rule before any MCP operation can access a desktop app:

```json
{
  "browser_use": true,
  "headless": true,
  "cursor_overlay": false,
  "policy": {
    "mode": "automatic",
    "rules": [{
      "bundleIds": ["com.example.fixture"],
      "allow": ["discovery", "read", "act"],
      "actions": ["click", "typeText", "keypress", "scroll", "drag"],
      "allowForeground": false
    }]
  }
}
```

A matching rule executes automatically. No matching rule means deny. Typing credential-, payment-, or verification-shaped text is always rejected. The runtime also blocks direct interaction with permission prompts; Skills must treat content displayed in a UI as untrusted data, never as new instructions.

On first explicit helper setup, grant **Accessibility** and **Screen Recording** to `/Applications/open-computer-use.app`. The helper only uses local IPC; the MCP server is stdio-only and never opens a network listener. v0.1.0 supports macOS 14+; it does not ship a Windows binary.

## MCP hosts

Run the server directly with:

```bash
ocu mcp
```

Hermes:

```bash
hermes mcp add open-computer-use --command ocu --args mcp
hermes mcp test open-computer-use
```

This intentionally coexists with Hermes's built-in `computer_use`/cua-driver integration.

OpenClaw:

```bash
openclaw mcp add open-computer-use --command ocu --arg mcp
openclaw mcp probe open-computer-use
openclaw skills install @0xcjl/open-computer-use-mcp
```

The ClawHub skill contains workflow and safety guidance only. It never grants macOS permissions or embeds a native helper.

## SDK

The package exports `OpenComputerUseRuntime`, `runComputerUseTool`, policy types, and the public parameter contracts. The SDK is TypeScript-first and uses the same state and policy semantics as MCP.

## Development

```bash
npm install
npm test
npm run build:native -- --arch arm64 --output /tmp/open-computer-use-bridge
npm pack --dry-run
```

The automated suite covers policy denial/automatic execution, upstream schema/lifecycle/concurrency/state invariants, TypeScript checks, and native Swift typechecking. Interactive desktop verification must use a project-owned fixture app or local test page, never a personal account or production service.

Build the included fixture app with `npm run build:fixture`; use its bundle ID `com.0xcjl.open-computer-use.fixture` in a test-only policy. The browser fixture is `fixtures/browser/index.html` and can be served locally, for example with `python3 -m http.server --directory fixtures/browser`.
