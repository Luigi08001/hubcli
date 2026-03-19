# Plugin Guide

hubcli supports plugins that add new command groups without modifying the core codebase.

## Plugin Contract

A plugin is an ESM module that exports a `register` function:

```typescript
import type { Command } from "commander";
import type { PluginContext } from "hubcli/plugins";

export function register(program: Command, ctx: PluginContext): void {
  const analytics = program.command("analytics").description("Analytics commands");

  analytics
    .command("report")
    .option("--days <n>", "Days to look back", "30")
    .action(async (opts) => {
      const cliCtx = ctx.getCtx();
      const client = ctx.createClient(cliCtx.profile);
      const res = await client.request(`/crm/v3/objects/contacts?limit=${opts.days}`);
      ctx.printResult(cliCtx, res);
    });
}
```

## PluginContext API

| Method | Description |
|--------|-------------|
| `getCtx()` | Returns current CLI context (profile, flags). **Call inside `.action()`, not at registration time.** |
| `createClient(profile)` | Creates an authenticated HubSpot API client for the given profile. |
| `printResult(ctx, data)` | Prints structured output to stdout (respects `--json`, `--format`). |
| `printError(ctx, error)` | Prints structured error to stderr. |
| `CliError` | Constructor for structured errors: `new ctx.CliError("CODE", "message")`. |
| `maybeWrite(ctx, client, method, path, body?)` | Write-safe helper. Enforces `--dry-run`, `--force`, and `--policy-file` gates automatically. |

## Write Safety

Always use `ctx.maybeWrite()` for mutations. This enforces all safety gates:

```typescript
analytics
  .command("delete-report")
  .argument("<id>")
  .action(async (id) => {
    const cliCtx = ctx.getCtx();
    const client = ctx.createClient(cliCtx.profile);
    const result = await ctx.maybeWrite(cliCtx, client, "DELETE", `/analytics/v1/reports/${id}`);
    ctx.printResult(cliCtx, result);
  });
```

- Without `--force`: throws `WRITE_CONFIRMATION_REQUIRED`
- With `--dry-run`: returns preview object without making the API call
- With `--policy-file`: enforces profile-level write/delete rules

## Plugin Discovery

### 1. npm packages (automatic)

Create an npm package with `"hubcli-plugin"` in its `keywords`:

```json
{
  "name": "hubcli-plugin-analytics",
  "keywords": ["hubcli-plugin"],
  "type": "module",
  "main": "index.js",
  "exports": { ".": "./index.js" }
}
```

Install it alongside hubcli:

```bash
npm install hubcli-plugin-analytics
```

hubcli scans `node_modules` at startup and loads any package with the `hubcli-plugin` keyword.

### 2. HUBCLI_PLUGINS env var (manual)

For local development or private plugins:

```bash
HUBCLI_PLUGINS=./my-plugin,/opt/plugins/custom hubcli analytics report
```

Comma-separated list of paths (relative to cwd) or npm package names.

## Local Development

```bash
mkdir hubcli-plugin-analytics
cd hubcli-plugin-analytics

cat > index.js << 'EOF'
export function register(program, ctx) {
  program
    .command("analytics")
    .description("Analytics commands (plugin)")
    .command("hello")
    .action(() => {
      const cliCtx = ctx.getCtx();
      ctx.printResult(cliCtx, { message: "Hello from analytics plugin!" });
    });
}
EOF

cd /path/to/hubcli
HUBCLI_PLUGINS=../hubcli-plugin-analytics hubcli analytics hello
```

## Error Handling

- Throw `ctx.CliError` for structured errors that follow hubcli's error format.
- Plugin load failures are logged to stderr but never crash the CLI.
- If a plugin's `register()` throws, it is skipped and the rest of the CLI works normally.

## TypeScript Setup

For TypeScript plugins, target `ES2022` / `NodeNext` to match the host:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist"
  }
}
```

Import types from hubcli:

```typescript
import type { PluginContext, HubcliPlugin } from "hubcli/plugins";
import type { CliContext } from "hubcli/output";
```

## Limitations

- Plugins cannot override built-in commands (Commander silently ignores duplicates).
- Plugins share the same process and Node.js context as the CLI.
- Plugin authors are responsible for their own error handling within `.action()` callbacks.
