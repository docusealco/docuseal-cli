# DocuSeal CLI vs Stripe CLI — Comparison

## Architecture

| | DocuSeal CLI | Stripe CLI |
|---|---|---|
| Language | TypeScript (Node.js) | Go |
| Framework | @oclif/core | Cobra |
| Spec-driven | Yes, OpenAPI spec at runtime | Yes, OpenAPI spec at build time |
| Generated code | Dynamic (at startup) | Static (pre-generated `resources_cmds.go`) |
| UX overrides | `ux-overrides.ts` (custom flags, hints, examples) | Hard-coded in Go files |
| Bundle size | 26KB (esbuild) | ~25MB (Go binary) |
| Distribution | npm (`npx @docuseal/cli`) | Homebrew, apt, scoop, Docker, npm |

## Command Naming

| | DocuSeal CLI | Stripe CLI |
|---|---|---|
| Pattern | `docuseal <topic> <action>` | `stripe <resource> <operation>` |
| Topic separator | space | space |
| Resource names | kebab-case (`templates`) | snake_case (`payment_intents`) |
| List | `templates list` | `customers list` |
| Get | `templates get 1001` | `customers retrieve cus_xxx` |
| Create | `submissions create` | `customers create` |
| Update | `templates update 1001` | `customers update cus_xxx` |
| Delete | `templates archive 1001` | `customers delete cus_xxx` |
| Variants | `templates create-pdf`, `templates create-docx` | N/A |
| Raw HTTP | N/A | `stripe get /v1/...`, `stripe post /v1/...` |

**Differences:**
- DocuSeal uses `get` for retrieve, Stripe uses `retrieve`
- DocuSeal uses `archive` for delete, Stripe uses `delete`
- DocuSeal resource names are kebab-case, Stripe keeps API snake_case (`payment_intents`)
- Stripe has raw HTTP commands (`get`, `post`, `delete`), DocuSeal does not

## Flag Naming

| | DocuSeal CLI | Stripe CLI |
|---|---|---|
| Convention | `--kebab-case` | `--kebab-case` |
| Source | API snake_case -> kebab-case | API snake_case -> kebab-case |
| Example | `--template-id`, `--folder-name` | `--unit-amount`, `--payment-method-types` |
| Nested params | Custom flags (`--submitter role=X,email=Y`) | Dot notation (`-d "metadata[key]=value"`) |
| Boolean flags | `--send-email true/false` (string) | `--live`, `--confirm` (real booleans) |
| Repeatable | `--submitter ... --submitter ...` | `-d key=val -d key=val` |
| ID argument | Positional (`templates get 1001`) | Positional (`customers retrieve cus_xxx`) |

**Differences:**
- DocuSeal booleans require explicit `true`/`false` value, Stripe uses real boolean flags
- DocuSeal uses typed custom flags for nested data, Stripe uses generic `-d key=value`
- Both convert API snake_case to CLI kebab-case

## Output

| | DocuSeal CLI | Stripe CLI |
|---|---|---|
| Default format | JSON (2-space indent) | JSON (colorized, syntax-highlighted) |
| Table mode | No | No |
| JSON colorization | No | Yes (keys=blue, strings=gray, numbers=cyan) |
| Success messages | Yes (`Template created  #1001`) | No (just raw JSON) |
| `--json` flag | Hidden (suppresses success message) | N/A (already JSON) |

**Differences:**
- Stripe colorizes JSON output, DocuSeal prints plain JSON
- DocuSeal shows friendly success messages for mutating operations, Stripe always shows raw JSON
- Both output JSON by default, neither has table mode

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
| Verify command | `docuseal whoami` | `stripe config --list` |
| Multiple profiles | N/A | `--project-name` flag |
| Key expiry | No | Yes (90 days for browser login) |

**Differences:**
- Stripe uses browser-based OAuth flow by default, DocuSeal prompts in terminal
- Stripe supports multiple profiles, DocuSeal has one config
- Both validate the key during setup
- Same priority chain: flag > env > file

## Error Handling

| | DocuSeal CLI | Stripe CLI |
|---|---|---|
| Format | Custom formatted | Raw API JSON |
| Hints | Yes, per-endpoint in ux-overrides | No (relies on API `doc_url`) |
| Exit code | 1 on error | 1 on error |

**DocuSeal error:**
```
✗  Not found (404)

   Run `docuseal templates list` to see available IDs.
```

**Stripe error:**
```
Request failed, status=404, body={
  "error": {
    "code": "resource_missing",
    "message": "No such customer: 'cus_xxx'",
    "doc_url": "https://stripe.com/docs/error-codes/resource-missing",
    "type": "invalid_request_error"
  }
}
```

**Differences:**
- DocuSeal shows a clean one-liner with optional CLI-specific hint
- Stripe dumps the full API error JSON with doc links

## Global Flags

| Flag | DocuSeal CLI | Stripe CLI |
|---|---|---|
| API key override | `--api-key` | `--api-key` |
| Server/env | `--server com/eu/url` | `--live` (test vs live) |
| Help | `--help` (oclif built-in) | `--help` / `-h` |
| Version | `--version` (oclif built-in) | `--version` / `-v` |
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
| Limit flag | `--limit` (from spec) | `--limit` / `-l` |
| Cursor flag | `--after` (from spec) | `--starting-after` / `-a` |
| Auto-pagination | No | No |

Both expose pagination as simple flags without automatic pagination loops.

## Special Commands

| Feature | DocuSeal CLI | Stripe CLI |
|---|---|---|
| Webhook listener | N/A | `stripe listen --forward-to localhost:4242` |
| Event trigger | N/A | `stripe trigger checkout.session.completed` |
| Log streaming | N/A | `stripe logs tail` |
| Raw HTTP | N/A | `stripe get/post/delete <path>` |
| Test fixtures | N/A | `stripe fixtures` |
| Dashboard open | N/A | `stripe open` |
| Samples | N/A | `stripe samples` |

Stripe has significantly more special commands. DocuSeal focuses on CRUD operations only.

## Summary

**What matches Stripe CLI:**
- Spec-driven architecture with auto-generated commands
- JSON output by default (no tables)
- `topic action` command structure
- kebab-case flags derived from snake_case API params
- Positional ID arguments
- Same config priority chain (flag > env > file)
- Same pagination approach (manual, no auto-pagination)

**What differs from Stripe CLI:**
- DocuSeal shows friendly success messages for mutations; Stripe always shows raw JSON
- DocuSeal has CLI-specific error hints; Stripe shows raw API errors
- DocuSeal uses `get` / `archive`; Stripe uses `retrieve` / `delete`
- DocuSeal does not colorize JSON output
- Stripe has many more special commands (listen, trigger, logs, raw HTTP)
- Stripe resource names keep API snake_case; DocuSeal uses kebab-case
- DocuSeal booleans are string flags; Stripe uses real boolean flags
