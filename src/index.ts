#!/usr/bin/env node
import { Command } from 'commander'
import { registerAllCommands } from './generator.ts'
import { registerConfigure } from './commands/configure.ts'
import { registerRawCommands } from './commands/raw.ts'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

const program = new Command()
  .name('docuseal')
  .description('Manage templates, submissions, and submitters')
  .version(pkg.version)

registerAllCommands(program)
registerConfigure(program)
registerRawCommands(program)

program.parse()
