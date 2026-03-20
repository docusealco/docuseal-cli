import chalk from 'chalk'

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
