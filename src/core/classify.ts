export type Action =
  | 'read' | 'validate' | 'publish' | 'write_story' | 'promote_real' | 'promote_local'
  | 'env_sync' | 'delete_story' | 'cloud_op' | 'config_change' | 'unknown'

export interface Classified {
  path: string
  action: Action
  flags: string[]
}

const READ_VERBS = new Set(['get', 'list', 'status', 'open', 'set', 'test', 'help', 'show'])

export function classify(tokens: string[]): Classified {
  const t = tokens[0] === 'agentia' ? tokens.slice(1) : tokens
  const words: string[] = []
  for (const tok of t) {
    if (tok.startsWith('-')) break
    words.push(tok)
  }
  const flags = t.filter((x) => x.startsWith('-'))
  const [top, topic, verb] = words
  const path = words.slice(0, 3).join(' ')
  const done = (action: Action): Classified => ({path, action, flags})

  if (top !== 'cicd') return done('unknown')
  if (topic === 'health-check') return done('read')

  if (topic === 'work') {
    if (verb === 'deployment-step') return done(words[3] === 'list' || words[3] === 'get' ? 'read' : 'write_story')
    switch (verb) {
      case 'promote': return done('promote_local') // skips quality gates
      case 'done': return done('promote_real')
      case 'submit': return done(flags.includes('--done') || flags.includes('--deploy') ? 'promote_real' : 'validate')
      case 'environment-sync': return done('env_sync')
      case 'delete': return done('delete_story')
      case 'publish':
      case 'push': return done('publish')
      case 'create':
      case 'update': return done('write_story')
      default: return done(verb && READ_VERBS.has(verb) ? 'read' : 'unknown')
    }
  }

  if (topic === 'cloud') return done('cloud_op')
  // Not yet inspected: treat non-read promotion commands as real promotions (conservative)
  if (topic === 'promotion') return done(verb && READ_VERBS.has(verb) ? 'read' : 'promote_real')

  return done(verb && READ_VERBS.has(verb) ? 'read' : 'config_change')
}