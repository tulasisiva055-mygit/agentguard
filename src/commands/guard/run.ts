import {spawn} from 'node:child_process'
import {userInfo} from 'node:os'
import {Command, Flags} from '@oclif/core'
import {createRequest, readRequest} from '../../core/approvals.js'
import {classify} from '../../core/classify.js'
import {evaluate} from '../../core/engine.js'
import {appendEntry} from '../../core/ledger.js'
import {loadPolicy} from '../../core/policy.js'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const RANK: Record<string, number> = {block: 3, escalate: 2, warn: 1, allow: 0}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const quote = (a: string) => (/[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)

function execute(tokens: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(`agentia ${tokens.map(quote).join(' ')}`, {shell: true, stdio: 'inherit'})
    child.on('close', (code) => resolve(code ?? 1))
  })
}

export default class GuardRun extends Command {
  static override description = 'Run an Agentia command only if the guard policy allows it'
  static override examples = [
    '<%= config.bin %> <%= command.id %> -- cicd work list',
    '<%= config.bin %> <%= command.id %> --env UAT --story US-1 -- cicd work submit --done',
  ]
  static override strict = false
  static override flags = {
    env: Flags.string({description: 'Target environment name'}),
    story: Flags.string({description: 'User story id or name (recorded in the audit log)'}),
    day: Flags.string({description: 'Override weekday for testing (Mon, Tue, ...)'}),
    components: Flags.integer({description: 'Number of components in the change'}),
    types: Flags.string({description: 'Comma-separated metadata types in the change'}),
    policy: Flags.string({description: 'Path to policy YAML'}),
    actor: Flags.string({description: 'Who or which agent is acting (default: OS user)'}),
    wait: Flags.integer({description: 'Seconds to wait for approval', default: 120}),
    'dry-run': Flags.boolean({description: 'Do everything except run the real command'}),
  }

  public async run(): Promise<void> {
    const {argv, flags} = await this.parse(GuardRun)
    let tokens = argv.map(String)
    if (tokens[0] === 'agentia') tokens = tokens.slice(1)
    if (tokens.length === 0) this.error('Put the command to run after "--", e.g. -- cicd work list')

    const actor = flags.actor ?? process.env.AGENTGUARD_ACTOR ?? userInfo().username
    const {policy, hash} = loadPolicy(flags.policy)
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

    const base = {
      actor,
      command: tokens.join(' '),
      action: c.action,
      env: flags.env ?? null,
      story: flags.story ?? null,
      policy: `${policy.name}@${hash}`,
    }

    // Strongest finding first, so the main reason is always the top line
    const sorted = [...result.findings].sort((a, b) => RANK[b.decision] - RANK[a.decision])
    const show = () => {
      for (const x of sorted) {
        this.log(`  - [${x.rule}] ${x.reason}${x.fix ? ` Fix: ${x.fix}` : ''}`)
      }
    }

    // BLOCK
    if (result.decision === 'block') {
      appendEntry({...base, event: 'blocked', decision: 'block', findings: result.findings})
      this.log(`BLOCKED by AgentGuard: ${sorted[0].reason}`)
      this.log('Command was NOT run.')
      if (sorted[0].fix) this.log(`Suggested fix: ${sorted[0].fix}`)
      process.exit(2)
    }

    // ESCALATE: wait for a human
    if (result.decision === 'escalate') {
      const req = createRequest({
        actor,
        command: base.command,
        env: base.env,
        story: base.story,
        findings: result.findings,
      })
      appendEntry({...base, event: 'escalated', decision: 'escalate', findings: result.findings, requestId: req.id})
      this.log('APPROVAL REQUIRED. Command is paused.')
      show()
      this.log(`\nAsk an approver to run:  agentia guard approve ${req.id}`)
      this.log(`Waiting up to ${flags.wait}s...`)

      const deadline = Date.now() + flags.wait * 1000
      let current = readRequest(req.id)
      while (current?.status === 'pending' && Date.now() < deadline) {
        await sleep(2000)
        current = readRequest(req.id)
      }

      if (current?.status === 'rejected') {
        appendEntry({...base, event: 'rejected', requestId: req.id, approver: current.decidedBy, reason: current.reason ?? null})
        this.log(`REJECTED by ${current.decidedBy}${current.reason ? ` (${current.reason})` : ''}. Command was NOT run.`)
        process.exit(4)
      }
      if (current?.status !== 'approved') {
        appendEntry({...base, event: 'approval_timeout', requestId: req.id})
        this.log('No decision before the timeout. Command was NOT run.')
        process.exit(3)
      }
      appendEntry({...base, event: 'approved', requestId: req.id, approver: current.decidedBy})
      this.log(`APPROVED by ${current.decidedBy}.`)
    } else if (result.findings.length > 0) {
      show()
    }

    // RUN
    if (flags['dry-run']) {
      appendEntry({...base, event: 'executed_dry_run', decision: result.decision})
      this.log('DRY RUN: policy passed, real command not executed.')
      return
    }
    const code = await execute(tokens)
    appendEntry({...base, event: 'executed', decision: result.decision, exitCode: code})
    if (code !== 0) process.exit(code)
  }
}