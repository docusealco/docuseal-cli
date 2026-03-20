import chalk from 'chalk'
import Table from 'cli-table3'

const STATUS_COLORS: Record<string, (s: string) => string> = {
  completed: chalk.green,
  pending: chalk.yellow,
  sent: chalk.yellow,
  awaiting: chalk.yellow,
  opened: chalk.cyan,
  declined: chalk.red,
  expired: chalk.gray,
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return chalk.gray('—')

  if (key === 'status' && typeof value === 'string') {
    const colorFn = STATUS_COLORS[value] ?? ((s: string) => s)
    return colorFn(value)
  }

  if ((key.endsWith('_at') || key.endsWith('_date')) && typeof value === 'string') {
    const diff = Date.now() - new Date(value).getTime()
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return `${Math.floor(diff / 86_400_000)}d ago`
  }

  const str = String(value)
  return str.length > 48 ? str.slice(0, 45) + '...' : str
}

export function renderTable(data: Record<string, unknown>[], columns: string[]): void {
  if (!data || data.length === 0) {
    console.log(chalk.gray('No results.'))
    return
  }

  const table = new Table({
    head: columns.map(c => chalk.gray(c)),
    style: { head: [], border: ['gray'] },
  })

  for (const row of data) {
    table.push(columns.map(col => formatValue(col, row[col])))
  }

  console.log(table.toString())
  console.log(chalk.gray(`  ${data.length} result${data.length === 1 ? '' : 's'}`))
}

export function renderJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

export function renderSuccess(message: string, details?: Record<string, string>): void {
  console.log(chalk.green('✓ ') + message)
  if (details) {
    for (const [key, value] of Object.entries(details)) {
      console.log(chalk.gray(`  ${key}: `) + value)
    }
  }
}

export function renderError(message: string, hint?: string): void {
  console.log(chalk.red('✗ ') + message)
  if (hint) console.log(chalk.gray(`\n  ${hint}`))
}
