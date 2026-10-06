import {userInfo} from 'node:os'
import {Args, Command, Flags} from '@oclif/core'
import {decideRequest} from '../../core/approvals.js'

export default class GuardApprove extends Command {
  static override description = 'Approve or reject a paused AgentGuard request'
  static override args = {
    id: Args.string({description: 'Request id shown by guard run', required: true}),
  }
  static override flags = {
    reject: Flags.boolean({description: 'Reject instead of approve'}),
    by: Flags.string({description: 'Approver name (default: OS user)'}),
    reason: Flags.string({description: 'Reason for the decision'}),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(GuardApprove)
    const by = flags.by ?? userInfo().username
    const want = flags.reject ? 'rejected' : 'approved'
    const req = decideRequest(args.id, want, by, flags.reason)
    if (!req) this.error(`No request found with id "${args.id}".`)
    if (req.status !== want) this.error(`Request ${req.id} was already ${req.status} by ${req.decidedBy}.`)
    this.log(`Request ${req.id} ${req.status} by ${by}.`)
  }
}