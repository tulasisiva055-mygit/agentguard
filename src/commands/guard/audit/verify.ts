import {Command} from '@oclif/core'
import {LEDGER_FILE, verifyLedger} from '../../../core/ledger.js'

export default class AuditVerify extends Command {
  static override description = 'Check that the audit log has not been tampered with'

  public async run(): Promise<void> {
    const r = verifyLedger()
    if (r.count === 0) this.error(`No ledger found at ${LEDGER_FILE}. Run "guard run" first.`)
    if (r.ok) {
      this.log(`LEDGER OK: ${r.count} records, hash chain intact.`)
      return
    }
    this.log(`LEDGER TAMPERED at record ${r.brokenAt}: ${r.reason}`)
    process.exit(1)
  }
}