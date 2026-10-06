import {existsSync, writeFileSync} from 'node:fs'
import {Command} from '@oclif/core'
import {DEFAULT_POLICY_YAML} from '../../core/policy.js'

export default class GuardInit extends Command {
  static override description = 'Create a starter guard.policy.yaml in the current folder'

  public async run(): Promise<void> {
    const file = 'guard.policy.yaml'
    if (existsSync(file)) this.error(`${file} already exists. Delete it first to regenerate.`)
    writeFileSync(file, DEFAULT_POLICY_YAML)
    this.log(`Created ${file}. Edit it to match your environment names and rules.`)
  }
}