#!/usr/bin/env node
import { execute, Config } from '@oclif/core'
import { registerAllCommands } from './generator.ts'
import Configure from './commands/configure.ts'
import WhoAmI from './commands/whoami.ts'

const generatedCommands = registerAllCommands()

function formatArgs(args: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [name, arg] of Object.entries(args || {})) {
    result[name] = { ...arg, name }
  }
  return result
}

function makeCommandEntry(id: string, CmdClass: any) {
  return {
    id,
    load: async () => CmdClass,
    description: CmdClass.description || '',
    args: formatArgs(CmdClass.args),
    flags: CmdClass.flags || {},
    examples: CmdClass.examples || [],
    strict: CmdClass.strict ?? true,
    aliases: [],
    hidden: false,
    pluginType: 'core' as const,
    pluginAlias: '@docuseal/generated',
  }
}

const syntheticPlugin = {
  name: '@docuseal/generated',
  commands: [
    ...[...generatedCommands.entries()].map(([id, CmdClass]) => makeCommandEntry(id, CmdClass)),
    makeCommandEntry('configure', Configure),
    makeCommandEntry('whoami', WhoAmI),
  ],
  topics: [
    { name: 'templates', description: 'Manage templates' },
    { name: 'submissions', description: 'Manage submissions' },
    { name: 'submitters', description: 'Manage submitters' },
  ],
}

const originalLoad = Config.prototype.load
Config.prototype.load = async function (this: any, ...args: any[]) {
  await originalLoad.apply(this, args)
  this.loadCommands(syntheticPlugin as any)
  this.loadTopics(syntheticPlugin as any)
}

execute({ dir: import.meta.url })
