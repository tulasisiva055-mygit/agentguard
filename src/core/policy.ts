import {createHash} from 'node:crypto'
import {existsSync, readFileSync} from 'node:fs'
import YAML from 'yaml'
import {z} from 'zod'

const DecisionZ = z.enum(['allow', 'warn', 'escalate', 'block'])

export const PolicySchema = z.object({
  version: z.number().default(1),
  name: z.string().default('default'),
  freeze_windows: z
    .array(z.object({name: z.string(), days: z.array(z.string()), envs: z.array(z.string())}))
    .default([]),
  protected_envs: z.array(z.string()).default([]),
  max_components_per_promotion: z.number().default(50),
  restricted_metadata: z.array(z.object({type: z.string(), action: DecisionZ})).default([]),
  actions: z.record(z.string(), DecisionZ).default({}),
})
export type Policy = z.infer<typeof PolicySchema>

export const DEFAULT_POLICY_YAML = `version: 1
name: default
freeze_windows:
  - name: Weekend freeze
    days: [Fri, Sat, Sun]
    envs: [PROD]
protected_envs: [UAT, PROD]
max_components_per_promotion: 50
restricted_metadata:
  - type: PermissionSet
    action: escalate
  - type: Profile
    action: escalate
actions:
  promote_real: escalate
  promote_local: escalate
  env_sync: escalate
  cloud_op: escalate
  delete_story: block
  publish: allow
  unknown: warn
`

export function loadPolicy(path = 'guard.policy.yaml') {
  const exists = existsSync(path)
  const text = exists ? readFileSync(path, 'utf8') : DEFAULT_POLICY_YAML
  const policy = PolicySchema.parse(YAML.parse(text))
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 12)
  return {policy, hash, source: exists ? path : 'built-in default'}
}