<p align="center">
  <a href="https://www.docuseal.com">
    <img width="70" src="https://www.docuseal.com/logo.svg" alt="DocuSeal Logo">
  </a>
</p>

<h1 align="center">DocuSeal CLI</h1>

<p align="center">
  Manage e-signature templates, submissions, and submitters with the terminal or AI agent.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/docuseal"><img src="https://img.shields.io/npm/v/docuseal.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/docuseal"><img src="https://img.shields.io/npm/dm/docuseal.svg" alt="npm downloads"></a>
  <a href="https://github.com/docusealco/docuseal-cli/blob/master/LICENSE.md"><img src="https://img.shields.io/npm/l/docuseal.svg" alt="license"></a>
</p>

---

## Quick Start

```bash
# Run directly with npx (no install needed)
npx docuseal configure

# Or install globally
npm install -g docuseal
docuseal configure
```

The `configure` command will prompt for your API token and server:

```
Server [global/europe/url] (default: global): global
Enter your API token: xxxxxxxxxx
✓ Saved to ~/.config/docuseal/credentials.json
```

Get your API token from [DocuSeal Console](https://console.docuseal.com/api) or [DocuSeal EU Console](https://console.docuseal.eu/api).

## Installation

```bash
npm install -g docuseal
```

**Requirements:** Node.js 18+

## Usage

```
docuseal [COMMAND]

TOPICS
  templates    Manage templates
  submissions  Manage submissions
  submitters   Manage submitters

COMMANDS
  configure    Configure API key and server
```

Every command supports `--help` for full usage details:

```bash
docuseal submissions create --help
```

---

## Configuration

### Interactive Setup

```bash
docuseal configure
```

### Non-Interactive Setup

```bash
docuseal configure --api-key YOUR_KEY --server global
```

### Show Current Config

```bash
docuseal configure --list
# ✓ Current configuration
#   api_key: vS7EwXPy...kDmq
#   server: https://api.docuseal.com
```

### Environment Variables

```bash
export DOCUSEAL_API_KEY=your_key
export DOCUSEAL_SERVER=global    # global, europe, or full URL
```

### Config File

Stored at `~/.config/docuseal/credentials.json`:

```json
{
  "apiKey": "your_key",
  "server": "https://api.docuseal.com"
}
```

**Priority:** CLI flag > environment variable > config file.

### Servers

| Value | URL                        |
|-------|----------------------------|
| `global` | `https://api.docuseal.com` |
| `europe` | `https://api.docuseal.eu`  |
| URL   | Your self-hosted instance  |

---

## Agent Skills

This CLI ships with an [agent skill](skills/docuseal-cli/SKILL.md) that teaches AI coding agents (Cursor, Claude Code, Windsurf, etc.) how to use the DocuSeal CLI effectively — including non-interactive flags, output formats, and common pitfalls.

Install skills from the [central skills repository](https://github.com/docusealco/docuseal-agent-skills):

```sh
npx skills add docusealco/docuseal-agent-skills
```

---

## Templates

### List Templates

```bash
docuseal templates list
docuseal templates list --folder Legal -l 50
docuseal templates list --archived
docuseal templates list --active
```

### Retrieve Template

```bash
docuseal templates retrieve 1001
```

### Create Template from PDF

```bash
docuseal templates create-pdf --file contract.pdf --name "NDA"
docuseal templates create-pdf --file form.pdf --folder-name Legal
```

### Create Template from DOCX

```bash
docuseal templates create-docx --file template.docx --name "Contract"
```

### Create Template from HTML

```bash
# Inline HTML
docuseal templates create-html --html "<p><text-field name=\"Name\"></text-field></p>" --name "Simple"

# From file
docuseal templates create-html --file template.html --name "Contract"
```

### Update Template

```bash
docuseal templates update 1001 --name "NDA v2"
docuseal templates update 1001 --folder-name Contracts
docuseal templates update 1001 -d "roles[]=Signer" -d "roles[]=Reviewer"
docuseal templates update 1001 --archive
docuseal templates update 1001 --unarchive
```

### Clone Template

```bash
docuseal templates clone 1001
docuseal templates clone 1001 --name "NDA Copy"
```

### Merge Templates

```bash
docuseal templates merge -d "template_ids[]=1001" -d "template_ids[]=1002"
docuseal templates merge -d "template_ids[]=1001" -d "template_ids[]=1002" --name "Combined"
```

### Update Template Documents

```bash
docuseal templates update-documents 1001 -d "documents[0][file]=https://example.com/doc.pdf" -d "documents[0][name]=New Doc"
docuseal templates update-documents 1001 --merge
```

### Archive Template

```bash
docuseal templates archive 1001
```

---

## Submissions

### List Submissions

```bash
docuseal submissions list
docuseal submissions list --status pending
docuseal submissions list --template-id 1001 -l 50
```

### Create Submission

Send a template for signing:

```bash
# Single submitter
docuseal submissions create \
  --template-id 1001 \
  -d "submitters[0][email]=john@acme.com"

# Multiple submitters with roles
docuseal submissions create \
  --template-id 1001 \
  -d "submitters[0][role]=Signer" \
  -d "submitters[0][email]=john@acme.com" \
  -d "submitters[1][role]=Witness" \
  -d "submitters[1][email]=jane@acme.com"

# With options
docuseal submissions create \
  --template-id 1001 \
  -d "submitters[0][email]=john@acme.com" \
  --no-send-email \
  --expire-at "2025-12-31" \
  --order random

# Using JSON
docuseal submissions create \
  --template-id 1001 \
  -d '{"submitters":[{"email":"john@acme.com","role":"Signer"}]}'
```

### Create Submission from PDF

Skip template creation — send a tagged PDF directly for signing:

```bash
docuseal submissions create-pdf \
  --file document.pdf \
  -d "submitters[0][email]=john@acme.com"
```

### Create Submission from DOCX

```bash
docuseal submissions create-docx \
  --file document.docx \
  -d "submitters[0][email]=john@acme.com"
```

### Send by Email

Send a template to multiple email addresses at once:

```bash
docuseal submissions send-emails \
  --template-id 1001 \
  --emails john@acme.com,jane@acme.com
```

### Retrieve Submission

```bash
docuseal submissions retrieve 502
```

### Get Submission Documents

```bash
docuseal submissions documents 502
docuseal submissions documents 502 --merge
```

### Archive Submission

```bash
docuseal submissions archive 502
```

---

## Submitters

### List Submitters

```bash
docuseal submitters list
docuseal submitters list --submission-id 502
```

### Retrieve Submitter

```bash
docuseal submitters retrieve 201
```

### Update Submitter

```bash
# Change email
docuseal submitters update 201 --email new@acme.com

# Mark as completed (auto-sign via API)
docuseal submitters update 201 --completed

# Re-send signature request
docuseal submitters update 201 --send-email

# Pre-fill fields and metadata
docuseal submitters update 201 -d "values[First Name]=John" -d "metadata[department]=Sales"
```

---

## Global Flags

These flags work on every command:

| Flag          | Description                                   |
|---------------|-----------------------------------------------|
| `--api-key`   | Override API key for this invocation           |
| `--server`    | Server: `global`, `europe`, or full URL         |

Flags available on list commands:

| Flag            | Description                               |
|-----------------|-------------------------------------------|
| `-l`, `--limit` | Limit number of results                   |
| `-a`, `--after` | Cursor for pagination                     |

Flag available on commands with body parameters:

| Flag          | Description                                   |
|---------------|-----------------------------------------------|
| `-d`, `--data`| Set params with bracket notation or JSON (repeatable) |

### Override Server Per-Command

```bash
# Query a different server without changing config
docuseal templates list --server europe
docuseal templates list --server https://docuseal.yourdomain.com
```

---

## Development

### Setup

```bash
git clone https://github.com/docusealco/docuseal-cli.git
cd docuseal-cli
npm install
```

### Run from Source

```bash
DOCUSEAL_API_KEY=your_key npm run dev -- templates list
npm run dev -- --help
```

### Run Tests

```bash
npm test
```

### Install Locally

```bash
npm run build
npm link
```

This creates a global `docuseal` command that points to your local source. Any code changes take effect after `npm run build`.

To unlink:

```bash
npm unlink -g docuseal
```

### Build

```bash
npm run build
```

Bundles everything into `dist/index.js` using esbuild.

---

## API Documentation

This CLI wraps the [DocuSeal API](https://www.docuseal.com/docs/api). Every API parameter is available as a CLI flag or `-d` data parameter.

Run `--help` on any command to see all available flags and data parameters:

```bash
docuseal templates create-pdf --help
docuseal submissions create --help
docuseal submitters update --help
```

---

## Configuration

| Item | Path | Notes |
|------|------|-------|
| Config directory | `~/.config/docuseal/` | Respects `$XDG_CONFIG_HOME` on Linux, `%APPDATA%` on Windows |
| Credentials | `~/.config/docuseal/credentials.json` | `0600` permissions (owner read/write only) |
| Install directory | Global npm prefix | Via `npm install -g docuseal` |

---

## License

MIT
