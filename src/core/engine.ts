import type {Action} from './classify.js'
import type {Policy} from './policy.js'

export type Decision = 'allow' | 'warn' | 'escalate' | 'block'
const ORDER: Decision[] = ['allow', 'warn', 'escalate', 'block']

export interface Ctx {
  action: Action
  env?: string
  day: string
  components?: number
  types: string[]
}
export interface Finding {
  rule: string
  decision: Decision
  reason: string
  fix?: string
}

const PROMOTING: Action[] = ['promote_real', 'promote_local', 'env_sync']
const lc = (s: string) => s.toLowerCase()
const has = (list: string[], v?: string) => v !== undefined && list.some((x) => lc(x) === lc(v))

export function evaluate(ctx: Ctx, p: Policy) {
  const f: Finding[] = []
  const promoting = PROMOTING.includes(ctx.action)

  const base = p.actions[ctx.action]
  if (base && base !== 'allow') {
    f.push({rule: 'action-policy', decision: base, reason: `Action "${ctx.action}" is set to ${base} by policy.`})
  }

  if (promoting && !ctx.env) {
    f.push({rule: 'unknown-env', decision: 'warn', reason: 'Target environment not provided, so environment rules were skipped.', fix: 'Pass --env <name>.'})
  }

  if (promoting) {
    for (const w of p.freeze_windows) {
      if (has(w.days, ctx.day) && has(w.envs, ctx.env)) {
        f.push({rule: 'freeze-window', decision: 'block', reason: `"${w.name}" is active (${ctx.day}) for ${ctx.env}.`, fix: 'Target a non-frozen environment or wait until the window ends.'})
      }
    }
  }

  if (ctx.action === 'promote_local' && has(p.protected_envs, ctx.env)) {
    f.push({rule: 'quality-gate-bypass', decision: 'block', reason: `"work promote" skips quality gates and ${ctx.env} is protected.`, fix: 'Use "cicd work submit" so quality gates run.'})
  }

  if (promoting && ctx.components !== undefined && ctx.components > p.max_components_per_promotion) {
    f.push({rule: 'blast-radius', decision: 'escalate', reason: `${ctx.components} components exceeds the limit of ${p.max_components_per_promotion}.`, fix: 'Split the change into smaller promotions.'})
  }

  if (promoting || ctx.action === 'publish') {
    for (const r of p.restricted_metadata) {
      if (ctx.types.some((t) => lc(t) === lc(r.type))) {
        f.push({rule: 'restricted-metadata', decision: r.action, reason: `Change includes restricted type ${r.type}.`})
      }
    }
  }

  const decision = f.reduce<Decision>((d, x) => (ORDER.indexOf(x.decision) > ORDER.indexOf(d) ? x.decision : d), 'allow')
  return {decision, findings: f}
}