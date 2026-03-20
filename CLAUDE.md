# DocuSeal CLI

## Architecture Overview

This CLI is **spec-driven with UX overrides**.

- `openapi-spec.json` — fetched from the live DocuSeal API, source of truth for all endpoints/params
- `src/ux-overrides.ts` — hand-crafted UX layer: custom flags, examples
- `src/generator.ts` — merges spec + overrides → registers commander commands at runtime
- `src/lib/` — HTTP client, config, output helpers

When the DocuSeal API changes:
1. Run `npm run sync-spec` → `openapi-spec.json` updates
2. Simple changes (new query param, new endpoint) → CLI updates automatically
3. Complex changes (new nested body param) → add a few lines to `ux-overrides.ts`

Never edit generated command logic directly — change `ux-overrides.ts` or the generator instead.

---

## Project Structure

```
docuseal-cli/
  openapi-spec.json          # auto-fetched, never edit manually
  bin/
    run.js                   # Node entrypoint for npm/npx
  dist/
    index.js                 # bundled output (esbuild)
  src/
    index.ts                 # commander entrypoint
    generator.ts             # reads spec + overrides, registers commands
    ux-overrides.ts          # UX layer: custom flags, examples
    lib/
      api.ts                 # apiFetch() — all HTTP goes here
      config.ts              # ~/.docuseal/config.yml read/write
      output.ts              # renderJson, renderSuccess, renderError
      errors.ts              # DocuSealError, handleApiError
    commands/
      configure.ts           # configure command (interactive setup + --list)
      raw.ts                 # raw HTTP commands (get, post, put, delete)
  scripts/
    sync-spec.ts             # fetches openapi.yml → saves as openapi-spec.json
  package.json
  tsconfig.json
```

---

## Tech Stack

- Runtime: Node.js
- CLI framework: commander
- HTTP: native fetch
- Config: yaml (read/write ~/.docuseal/config.yml)
- Dev: tsx (TypeScript execution), esbuild (bundling)

---

## lib/api.ts Rules

- Single exported function: `apiFetch<T>(path, opts?): Promise<T>`
- Always reads base URL + API key from `loadConfig()`
- Builds query string from `opts.query`, skipping null/undefined values
- Sets `X-Auth-Token` header
- On non-2xx: calls `handleApiError(res, url)` which throws `DocuSealError` with the raw response body
- Never use `fetch()` directly anywhere outside this file

## lib/output.ts Rules

- `renderJson(data)` — JSON.stringify with 2-space indent
- `renderSuccess(message, details?)` — "✓" + message + optional key/value rows
- `renderError(message, hint?)` — "✗" + message + optional hint line
- Never use `console.log()` directly in generator or command files

## ux-overrides.ts Rules

- Keyed by `"METHOD /path"` matching the OpenAPI spec exactly
- Each entry is partial — only override what needs customization
- `customFlags` — additional flags not in spec (e.g. --file for local file upload with base64 encoding)
- `examples` — array of example strings for --help output
- `successMessage(result)` — function returning string for success output

## generator.ts Rules

- Iterates over all paths in openapi-spec.json
- For each operation: merges spec params with ux-overrides for that path
- Registers commander commands via fluent API (`program.command(topic).command(action)`)
- Spec params → flags automatically (string/integer/boolean based on schema type)
- Boolean params → real boolean flags (`--flag` / `--no-flag`)
- Enum params → validated against allowed values via `.choices()`
- Required params → `.makeOptionMandatory()`
- Custom flags from overrides → added on top, take precedence for naming
- `-d` / `--data` flag on every command — Stripe-style bracket notation for nested/array body params
- `parseDataFlags()` parses bracket notation into nested objects/arrays, deep-merged into body
- Short flags: `-l` (limit), `-a` (after), `-d` (data)
- API errors → raw JSON output (like Stripe CLI)

---

## Global Flags (on every command)

- `-d` / `--data` — set body params with bracket notation, repeatable (e.g. `-d "submitters[0][email]=john@acme.com"`)
- `--api-key` — override API key for this invocation
- `--server` — override server: `com`, `eu`, or full URL for self-hosted

---

## Config

File: `~/.docuseal/config.yml`
Fields: `apiKey`, `server`
Env var overrides: `DOCUSEAL_API_KEY`, `DOCUSEAL_SERVER`
Priority: CLI flag > env var > config file

---

## Error Format

API errors output raw JSON from the server:

```json
{
  "error": "Not found"
}
```

## Success Message Format

```
✓  Submission created  #502
   john@acme.com → https://docuseal.com/s/pAMimKcyrLjqVt
```

---

## Build & Publish

```bash
npm run dev -- --help                # run locally from TS source (uses tsx)
npm run sync-spec                    # update openapi-spec.json from live API
npm run build                        # bundle to dist/index.js (esbuild)
npm publish                          # publish to npm (runs build via prepublishOnly)
```

Distribution: `npx @docuseal/cli` or `npm install -g @docuseal/cli`

---

## Testing During Development

```bash
DOCUSEAL_API_KEY=your_key npm run dev -- --help
DOCUSEAL_API_KEY=your_key npm run dev -- templates list
DOCUSEAL_API_KEY=your_key npm run dev -- submissions create --template-id 1 -d "submitters[0][email]=test@example.com"
DOCUSEAL_API_KEY=your_key npm run dev -- get /templates
DOCUSEAL_API_KEY=your_key npm run dev -- post /submissions -d "template_id=1"
```
