import {Command, Flags} from '@oclif/core'
import {classify} from '../../core/classify.js'
import {evaluate} from '../../core/engine.js'
import {loadPolicy} from '../../core/policy.js'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EXIT = {allow: 0, warn: 0, block: 2, escalate: 3} as const

export default class GuardCheck extends Command {
  static override description = 'Check an Agentia command against the guard policy (dry run, executes nothing)'
  static override examples = [
    '<%= config.bin %> <%= command.id %> --env PROD -- cicd work submit --done',
    '<%= config.bin %> <%= command.id %> -- cicd work list',
  ]
  static override strict = false
  static override flags = {
    env: Flags.string({description: 'Target environment name'}),
    day: Flags.string({description: 'Override weekday for testing (Mon, Tue, ...)'}),
    components: Flags.integer({description: 'Number of components in the change'}),
    types: Flags.string({description: 'Comma-separated metadata types in the change'}),
    policy: Flags.string({description: 'Path to policy YAML (default: guard.policy.yaml)'}),
    json: Flags.boolean({description: 'Output JSON'}),
  }

  public async run(): Promise<void> {
    const {argv, flags} = await this.parse(GuardCheck)
    const tokens = argv.map(String)
    if (tokens.length === 0) this.error('Put the command to check after "--", e.g. -- cicd work promote')

    const {policy, hash, source} = loadPolicy(flags.policy)
    const c = classify(tokens)
    const result = evaluate(
      {
        action: c.action,
        env: flags.env,
        day: flags.day ?? DAYS[new Date().getDay()],
        components: flags.components,
        types: flags.types ? flags.types.split(',').map((s) => s.trim()) : [],
      },
      policy,
    )

    const out = {command: tokens.join(' '), action: c.action, decision: result.decision, findings: result.findings, policy: {name: policy.name, hash, source}}

    if (flags.json) {
      this.log(JSON.stringify(out, null, 2))
    } else {
      this.log(`Command : ${out.command}`)
      this.log(`Action  : ${c.action}`)
      this.log(`Decision: ${result.decision.toUpperCase()}   (policy: ${policy.name} ${hash}, ${source})`)
      for (const x of result.findings) {
        this.log(`  - [${x.rule}] ${x.decision}: ${x.reason}${x.fix ? ` Fix: ${x.fix}` : ''}`)
      }
    }
    const code = EXIT[result.decision]
    if (code !== 0) this.exit(code)
  }
}