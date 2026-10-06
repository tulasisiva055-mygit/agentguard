import {Command} from '@oclif/core'
import {runAgentia} from '../../core/agentia.js'

export default class GuardPing extends Command {
  static override description = 'Verify AgentGuard can call the Agentia CLI and read your Copado data'

  public async run(): Promise<void> {
    const r = await runAgentia(['cicd', 'work', 'list'])
    if (!r.ok) this.error(`Agentia call failed: ${r.error ?? r.raw}`)
    this.log(`OK. Agentia returned ${Array.isArray(r.data) ? r.data.length : 0} user stories.`)
  }
}