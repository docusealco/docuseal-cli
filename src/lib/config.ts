import { parse, stringify } from 'yaml'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export type DocuSealConfig = {
  apiKey: string
  server: string
}

const CONFIG_DIR = join(homedir(), '.docuseal')
const CONFIG_FILE = join(CONFIG_DIR, 'config.yml')

const SERVER_MAP: Record<string, string> = {
  com: 'https://api.docuseal.com',
  eu: 'https://api.docuseal.eu',
}

export function resolveServer(input: string): string {
  return SERVER_MAP[input] ?? input
}

export function loadConfig(overrides?: Partial<DocuSealConfig>): DocuSealConfig {
  let fileConfig: any = {}
  if (existsSync(CONFIG_FILE)) {
    fileConfig = parse(readFileSync(CONFIG_FILE, 'utf8')) || {}
  }

  const apiKey =
    overrides?.apiKey ??
    process.env.DOCUSEAL_API_KEY ??
    fileConfig.apiKey

  const server = resolveServer(
    overrides?.server ??
    process.env.DOCUSEAL_SERVER ??
    fileConfig.server ??
    'com'
  )

  if (!apiKey) {
    throw new Error(
      'No API key found.\nRun `docuseal configure` or set the DOCUSEAL_API_KEY environment variable.'
    )
  }

  return { apiKey, server }
}

export function saveConfig(config: DocuSealConfig): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, stringify(config))
}
