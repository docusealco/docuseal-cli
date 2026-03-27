# DocuSeal CLI

## Architecture Overview

Static command files with explicit flags and action handlers. No runtime code generation.

- `src/commands/templates.js` — all template commands (list, retrieve, update, archive, create-pdf, create-docx, create-html, clone, merge, update-documents)
- `src/commands/submissions.js` — all submission commands (list, retrieve, archive, create, send-emails, create-pdf, create-docx, create-html, documents)
- `src/commands/submitters.js` — all submitter commands (list, retrieve, update)
- `src/commands/configure.js` — interactive config setup
- `src/commands/raw.js` — raw HTTP commands (get, post, put, delete)
- `src/lib/` — HTTP client, config, output helpers, data-flags parser, global options

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
      api.js                 # createClient(), onError() — all HTTP goes here
      config.js              # ~/.docuseal/config.yml read/write
      output.js              # renderJson
      data-flags.js          # parseDataFlags(), deepMerge(), coerce()
      global-options.js      # withGlobalOptions(), formatDataParams(), formatExamples()
  tests/
    templates.test.js
    submissions.test.js
    submitters.test.js
  package.json
```

---

## Tech Stack

- Runtime: Node.js (ESM)
- CLI framework: commander
- HTTP: `@docuseal/api` package
- Config: yaml (read/write ~/.docuseal/config.yml)
- Bundling: esbuild

---

## Command File Pattern

Each command file exports a `register*Commands(program)` function that:
1. Creates a topic command (`program.command('templates')`)
2. Registers subcommands with explicit flags, data params, examples, and action handlers
3. Builds query/body from options, calls API client methods, renders JSON output

```js
import { withGlobalOptions, formatDataParams, formatExamples } from '../lib/global-options.js'

export function registerTemplateCommands(program) {
  const topic = program.command('templates').description('Manage templates')

  withGlobalOptions(topic.command('list'))
    .description('List all templates')
    .addOption(new Option('--folder <value>', 'Filter templates by folder name.'))
    .addOption(new Option('-l, --limit <value>', '...').argParser(parseInt))
    .addHelpText('afterAll', formatExamples([
      'docuseal templates list',
      'docuseal templates list --folder Legal --limit 50',
    ]))
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
- Global options (`--api-key`, `--server`) → applied via `withGlobalOptions(cmd)`
- Data params help section → `formatDataParams([['key', 'description'], ...])`
- Examples help section → `formatExamples(['docuseal ...', ...])`

Help section order: Options → Data Parameters (`after`) → Global Options (`afterAll`) → Examples (`afterAll`)

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

- `createClient(opts)` — creates a `DocusealApi` instance from config + optional overrides
- `onError(err)` — handles `DocusealApiError`, renders raw JSON error and exits
- Config is loaded via `loadConfig()` with optional `apiKey`/`server` overrides from CLI flags
- Never use `fetch()` directly anywhere outside this file

## lib/output.js Rules

- `renderJson(data)` — JSON.stringify with 2-space indent
- Never use `console.log()` directly in command files

## lib/data-flags.js

- `coerce(v)` — auto-converts string values: `"true"` → `true`, `"false"` → `false`, numeric strings → numbers
- `parseDataFlags(pairs)` — parses bracket notation (e.g. `submitters[0][email]=john@acme.com`) into nested objects/arrays, with auto-coercion
- `deepMerge(target, source)` — recursively merges objects and arrays
- Used by all command files for `-d` flag support

## lib/global-options.js

- `withGlobalOptions(cmd)` — adds hidden `--api-key` and `--server` options + Global Options help text to a command
- `formatDataParams(params)` — formats `[key, description]` pairs into aligned Data Parameters help section
- `formatExamples(examples)` — formats string array into Examples help section

---

## Global Flags (on every command via `withGlobalOptions`)

- `--api-key` — override API key for this invocation
- `--server` — override server: `com`, `eu`, or full URL for self-hosted

## Common Flags (on list commands)

- `-l` / `--limit` — limit number of results
- `-a` / `--after` — cursor for pagination

## Data Flag (on commands with body params)

- `-d` / `--data` — set body params with bracket notation, repeatable

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
npm test                             # run tests
npm publish                          # publish to npm (runs build via prepublishOnly)
```

Distribution: `npx @docuseal/cli` or `npm install -g @docuseal/cli`

---

## Testing During Development

```bash
npm test                             # run all tests

DOCUSEAL_API_KEY=your_key npm run dev -- --help
DOCUSEAL_API_KEY=your_key npm run dev -- templates list
DOCUSEAL_API_KEY=your_key npm run dev -- submissions create --template-id 1 -d "submitters[0][email]=test@example.com"
DOCUSEAL_API_KEY=your_key npm run dev -- get /templates
DOCUSEAL_API_KEY=your_key npm run dev -- post /submissions/init -d "template_id=1"
```
