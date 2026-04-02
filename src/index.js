#!/usr/bin/env node
import { Command } from 'commander'
import { registerTemplateCommands } from './commands/templates.js'
import { registerSubmissionCommands } from './commands/submissions.js'
import { registerSubmitterCommands } from './commands/submitters.js'
import { registerConfigure } from './commands/configure.js'
import pkg from '../package.json' with { type: 'json' }

const program = new Command()
  .name('docuseal')
  .description('Manage templates, submissions, and submitters')
  .version(pkg.version)

registerConfigure(program)
registerTemplateCommands(program)
registerSubmissionCommands(program)
registerSubmitterCommands(program)

program.parse()
