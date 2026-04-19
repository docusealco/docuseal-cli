import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

function getConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return join(process.env.XDG_CONFIG_HOME, 'docuseal')
  } else if (process.platform === 'win32' && process.env.APPDATA) {
    return join(process.env.APPDATA, 'docuseal')
  } else {
    return join(homedir(), '.config', 'docuseal')
  }
}

const CONFIG_DIR = getConfigDir()
const CONFIG_FILE = join(CONFIG_DIR, 'credentials.json')

const SERVER_MAP = {
  global: 'https://api.docuseal.com',
  europe: 'https://api.docuseal.eu',
}

export function resolveServer(input) {
  if (SERVER_MAP[input]) return SERVER_MAP[input]

  const url = input.replace(/\/+$/, '')

  if (Object.values(SERVER_MAP).includes(url)) return url

  return url.endsWith('/api') ? url : url + '/api'
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
    'global'
  )

  if (!apiKey) {
    throw new Error(
      'No API key found.\nRun `docuseal configure` or set the DOCUSEAL_API_KEY environment variable.'
    )
  }

  return { apiKey, server }
}

export function saveConfig(config) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })

  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 })
  chmodSync(CONFIG_FILE, 0o600)
}
