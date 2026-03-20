export function renderJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

export function renderSuccess(message: string, details?: Record<string, string>): void {
  console.log('✓ ' + message)
  if (details) {
    for (const [key, value] of Object.entries(details)) {
      console.log(`  ${key}: ${value}`)
    }
  }
}

export function renderError(message: string, hint?: string): void {
  console.log('✗ ' + message)
  if (hint) console.log(`\n  ${hint}`)
}
