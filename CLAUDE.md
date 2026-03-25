# DocuSeal CLI

## Architecture Overview

Static command files with explicit flags and action handlers. No runtime code generation.

- `src/commands/templates.js` — all template commands (list, retrieve, update, archive, create-pdf, create-docx, create-html, clone, merge, update-documents)
- `src/commands/submissions.js` — all submission commands (list, retrieve, archive, create, send-emails, create-pdf, create-docx, create-html, documents)
- `src/commands/submitters.js` — all submitter commands (list, retrieve, update)
- `src/commands/configure.js` — interactive config setup
- `src/commands/raw.js` — raw HTTP commands (get, post, put, delete)
- `src/lib/` — HTTP client, config, output helpers, data-flags parser

When the DocuSeal API changes, edit the command files directly.

---

## Project Structure

```
docuseal-cli/
  bin/
    run.js                   # Node entrypoint for npm/npx
  dist/
    index.js                 # bundled output (esbuild)
  src/
    index.js                 # commander entrypoint
    commands/
      templates.js           # template commands
      submissions.js         # submission commands
      submitters.js          # submitter commands
      configure.js           # configure command (interactive setup + --list)
      raw.js                 # raw HTTP commands (get, post, put, delete)
    lib/
      api.js                 # apiFetch() — all HTTP goes here
      config.js              # ~/.docuseal/config.yml read/write
      output.js              # renderJson
      errors.js              # DocuSealError
      data-flags.js          # parseDataFlags(), deepMerge()
  package.json
```

---

## Tech Stack

- Runtime: Node.js (ESM)
- CLI framework: commander
- HTTP: native fetch
- Config: yaml (read/write ~/.docuseal/config.yml)
- Bundling: esbuild

---

## Command File Pattern

Each command file exports a `register*Commands(program)` function that:
1. Creates a topic command (`program.command('templates')`)
2. Registers subcommands with explicit flags, examples, and action handlers
3. Builds query/body from options, calls `apiFetch()`, renders JSON output

```js
export function registerTemplateCommands(program) {
  const topic = program.command('templates').description('Manage templates')

  topic
    .command('list')
    .option('--api-key <value>', '...')
    .option('--server <value>', '...')
    .option('-d, --data <value>', '...', (val, prev) => prev.concat([val]), [])
    .addOption(new Option('-l, --limit <value>', '...').argParser(parseInt))
    .addHelpText('after', '\nExamples:\n  $ docuseal templates list')
    .action(async (opts) => { /* ... */ })
}
```

Key conventions:
- String params → `.addOption(new Option('--flag <value>', 'desc'))`
- Integer params → `.argParser(parseInt)`
- Boolean params → `--flag` / `--no-flag` pair
- Enum params → `.choices([...])`
- Required params → `.makeOptionMandatory()`
- File upload commands (create-pdf, create-docx) → `--file` flag with `readFileSync` + base64 encoding
- Complex/nested body params (submitters, documents, template_ids) → handled via `-d` bracket notation

## Updating Commands from OpenAPI Spec

Source: `https://console.docuseal.com/openapi.json`

Mapping rules:
- Resource group = first path segment after `/api/` (templates, submissions, submitters)
- Command name from path: `GET /templates` → `list`, `GET /templates/{id}` → `retrieve`, `PUT` → `update`, `DELETE` → `archive`, `POST /templates/pdf` → `create-pdf`, `POST /submissions/emails` → `send-emails`
- GET query params → explicit flags with `addOption`
- Request body scalar params (string, integer, boolean) → explicit flags
- Request body complex params (arrays, objects) → skip, users pass them via `-d` bracket notation
- When a custom flag like `--file` maps to a complex body param (e.g. `documents`), that param's `makeOptionMandatory()` is removed
- Path params like `{id}` → `.argument('<id>', '...')`
- Param descriptions come from OpenAPI `description` field
- `snake_case` body keys map to `--kebab-case` flags, converted back in the action handler

---

## lib/api.js Rules

- Single exported function: `apiFetch(path, opts?)`
- Always reads base URL + API key from `loadConfig()`
- Builds query string from `opts.query`, skipping null/undefined values
- Sets `X-Auth-Token` header
- On non-2xx: throws `DocuSealError` with the raw response body
- Never use `fetch()` directly anywhere outside this file

## lib/output.js Rules

- `renderJson(data)` — JSON.stringify with 2-space indent
- Never use `console.log()` directly in command files

## lib/data-flags.js

- `parseDataFlags(pairs)` — parses bracket notation (e.g. `submitters[0][email]=john@acme.com`) into nested objects/arrays
- `deepMerge(target, source)` — recursively merges objects and arrays
- Used by all command files for `-d` flag support

---

## Global Flags (on every command)

- `-d` / `--data` — set body params with bracket notation, repeatable
- `--api-key` — override API key for this invocation
- `--server` — override server: `com`, `eu`, or full URL for self-hosted

Short flags: `-l` (limit), `-a` (after), `-d` (data)

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

---

## Build & Publish

```bash
npm run dev -- --help                # run locally
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
