import { Option } from 'commander'

export function withGlobalOptions(cmd) {
  return cmd
    .addOption(new Option('--api-key <value>').hideHelp())
    .addOption(new Option('--server <value>').hideHelp())
    .addHelpText('after', '\nGlobal Options:\n      --api-key <value>   Override API key for this invocation\n      --server <value>    Server: com, eu, or full URL')
}
