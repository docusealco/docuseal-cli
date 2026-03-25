import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const CONFIG_DIR = join(homedir(), '.docuseal')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

const SERVER_MAP = {
  com: 'https://api.docuseal.com',
  eu: 'https://api.docuseal.eu',
}

export function resolveServer(input) {
  return SERVER_MAP[input] ?? input
}

export function loadConfig(overrides) {
  let fileConfig = {}
  if (existsSync(CONFIG_FILE)) {
    fileConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
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

export function saveConfig(config) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n')
}
