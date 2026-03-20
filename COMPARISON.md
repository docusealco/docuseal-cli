# DocuSeal CLI vs Stripe CLI — Comparison

## Architecture

| | DocuSeal CLI | Stripe CLI |
|---|---|---|
| Language | TypeScript (Node.js) | Go |
| Framework | Commander | Cobra |
| Spec-driven | Yes, OpenAPI spec at runtime | Yes, OpenAPI spec at build time |
| Generated code | Dynamic (at startup) | Static (pre-generated `resources_cmds.go`) |
| UX overrides | `ux-overrides.ts` (custom flags, examples) | Hard-coded in Go files |
| Bundle size | ~24KB (esbuild) | ~25MB (Go binary) |
| Distribution | npm (`npx @docuseal/cli`) | Homebrew, apt, scoop, Docker, npm |

## Command Naming

| | DocuSeal CLI | Stripe CLI |
|---|---|---|
| Pattern | `docuseal <topic> <action>` | `stripe <resource> <operation>` |
| Topic separator | space | space |
| Resource names | kebab-case (`templates`) | snake_case (`payment_intents`) |
| List | `templates list` | `customers list` |
| Retrieve | `templates retrieve 1001` | `customers retrieve cus_xxx` |
| Create | `submissions create` | `customers create` |
| Update | `templates update 1001` | `customers update cus_xxx` |
| Delete | `templates archive 1001` | `customers delete cus_xxx` |
| Variants | `templates create-pdf`, `templates create-docx` | N/A |
| Raw HTTP | `docuseal get /templates`, `docuseal post /templates/pdf` | `stripe get /v1/...`, `stripe post /v1/...` |

**Differences:**
- DocuSeal uses `archive` for delete, Stripe uses `delete`
- DocuSeal resource names are kebab-case, Stripe keeps API snake_case (`payment_intents`)

## Flag Naming

| | DocuSeal CLI | Stripe CLI |
|---|---|---|
| Convention | `--kebab-case` | `--kebab-case` |
| Source | API snake_case -> kebab-case | API snake_case -> kebab-case |
| Example | `--template-id`, `--folder-name` | `--unit-amount`, `--payment-method-types` |
| Boolean flags | `--send-email` / `--no-send-email` | `--live`, `--confirm` |
| Nested params | `-d "submitters[0][email]=john@acme.com"` | `-d "metadata[key]=value"` |
| Repeatable | `-d key=val -d key=val` | `-d key=val -d key=val` |
| ID argument | Positional (`templates retrieve 1001`) | Positional (`customers retrieve cus_xxx`) |
| Short flags | `-d` (data), `-l` (limit), `-a` (after) | `-d` (data), `-l` (limit), `-a` (starting-after) |

No major differences. Flag conventions are nearly identical.

## Output

| | DocuSeal CLI | Stripe CLI |
|---|---|---|
| Default format | JSON (2-space indent) | JSON (colorized, syntax-highlighted) |
| Table mode | No | No |
| JSON colorization | No | Yes (keys=blue, strings=gray, numbers=cyan) |
| Success messages | Yes (`Template created  #1001`) | No (just raw JSON) |

**Differences:**
- Stripe colorizes JSON output, DocuSeal prints plain JSON
- DocuSeal shows friendly success messages for mutating operations, Stripe always shows raw JSON

## Authentication

| | DocuSeal CLI | Stripe CLI |
|---|---|---|
| Auth method | API key via `X-Auth-Token` header | API key via `Authorization: Bearer` |
| Setup command | `docuseal configure` | `stripe login` |
| Interactive | Prompts for server, then API key | Opens browser for pairing code |
| Non-interactive | `--api-key KEY --server com` | `stripe login --interactive` (paste key) |
| Config file | `~/.docuseal/config.yml` (YAML) | `~/.config/stripe/config.toml` (TOML) |
| Env var | `DOCUSEAL_API_KEY` | `STRIPE_API_KEY` |
| Priority | Flag > env var > config file | Flag > env var > config file |
| Validation | Calls API to verify key | Calls API to verify key |
| Show config | `docuseal configure --list` | `stripe config --list` |
| Multiple profiles | N/A | `--project-name` flag |
| Key expiry | No | Yes (90 days for browser login) |

**Differences:**
- Stripe uses browser-based OAuth flow by default, DocuSeal prompts in terminal
- Stripe supports multiple profiles, DocuSeal has one config

## Error Handling

| | DocuSeal CLI | Stripe CLI |
|---|---|---|
| Format | Raw API JSON | Raw API JSON |
| Exit code | 1 on error | 1 on error |

**DocuSeal error:**
```json
{
  "error": "Not found"
}
```

**Stripe error:**
```json
{
  "error": {
    "code": "resource_missing",
    "message": "No such customer: 'cus_xxx'",
    "doc_url": "https://stripe.com/docs/error-codes/resource-missing",
    "type": "invalid_request_error"
  }
}
```

Stripe includes structured error codes and doc links; DocuSeal returns the API error as-is.

## Global Flags

| Flag | DocuSeal CLI | Stripe CLI |
|---|---|---|
| API key override | `--api-key` | `--api-key` |
| Server/env | `--server com/eu/url` | `--live` (test vs live) |
| Help | `--help` / `-h` | `--help` / `-h` |
| Version | `--version` / `-V` | `--version` / `-v` |
| Color | N/A | `--color on/off/auto` |
| Log level | N/A | `--log-level debug/info/warn/error` |
| Config path | N/A | `--config <path>` |
| Profile | N/A | `--project-name` / `-p` |
| Show headers | N/A | `--show-headers` / `-s` |
| API version | N/A | `--stripe-version` |
| Expand | N/A | `--expand` / `-e` |
| Idempotency | N/A | `--idempotency` / `-i` |

## Pagination

| | DocuSeal CLI | Stripe CLI |
|---|---|---|
| Limit flag | `--limit` / `-l` | `--limit` / `-l` |
| Cursor flag | `--after` / `-a` | `--starting-after` / `-a` |
| Auto-pagination | No | No |

No major differences. Same approach to pagination.

## Special Commands

| Feature | DocuSeal CLI | Stripe CLI |
|---|---|---|
| Webhook listener | N/A | `stripe listen --forward-to localhost:4242` |
| Event trigger | N/A | `stripe trigger checkout.session.completed` |
| Log streaming | N/A | `stripe logs tail` |
| Raw HTTP | `docuseal get/post/put/delete <path>` | `stripe get/post/delete <path>` |
| Test fixtures | N/A | `stripe fixtures` |
| Dashboard open | N/A | `stripe open` |
| Samples | N/A | `stripe samples` |

Stripe has significantly more special commands. DocuSeal focuses on CRUD operations only.

## Summary

**What matches Stripe CLI:**
- Spec-driven architecture with auto-generated commands
- JSON output by default (no tables)
- `topic action` command structure with `retrieve` for fetching single resources
- kebab-case flags derived from snake_case API params
- Real boolean flags (`--flag` / `--no-flag`)
- `-d` bracket notation for nested/array params
- Short flags: `-l` (limit), `-a` (cursor), `-d` (data)
- Positional ID arguments
- Raw API JSON for errors
- Raw HTTP commands (`get`, `post`, `put`, `delete`)
- `configure --list` to show current config
- Same config priority chain (flag > env > file)
- Same pagination approach (manual, no auto-pagination)

**What differs from Stripe CLI:**
- DocuSeal shows friendly success messages for mutations; Stripe always shows raw JSON
- DocuSeal uses `archive`; Stripe uses `delete`
- DocuSeal does not colorize JSON output
- Stripe has more special commands (listen, trigger, logs, fixtures, samples)
- Stripe resource names keep API snake_case; DocuSeal uses kebab-case
