import { Option } from 'commander'

export function withGlobalOptions(cmd) {
  return cmd
    .addOption(new Option('--api-key <value>').hideHelp())
    .addOption(new Option('--server <value>').hideHelp())
    .addHelpText('afterAll', '\nGlobal Options:\n  --api-key <value>   Override API key for this invocation\n  --server <value>    Server: global, europe, or full URL (e.g. https://docuseal.yourdomain.com)')
}

export function formatDataParams(params) {
  const maxLen = Math.max(...params.map(([k]) => k.length))
  const lines = params.map(([k, v]) => `  ${k.padEnd(maxLen + 2)}${v}`)
  return '\nData Parameters (-d):\n' + lines.join('\n')
}

export function formatExamples(examples) {
  return '\nExamples:\n' + examples.map(e => `  $ ${e}`).join('\n')
}
