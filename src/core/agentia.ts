import {spawn} from 'node:child_process'

export interface AgentiaResult {
  ok: boolean
  status?: number
  data?: unknown
  raw: string
  error?: string
}

const quote = (a: string) => (/[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)

/** Runs `agentia <args> --json` and parses the {result, status} envelope. */
export function runAgentia(args: string[], timeoutMs = 60_000): Promise<AgentiaResult> {
  return new Promise((resolve) => {
    const cmd = `agentia ${args.map(quote).join(' ')} --json`
    const child = spawn(cmd, {shell: true})
    let out = ''
    let err = ''
    const timer = setTimeout(() => child.kill(), timeoutMs)

    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('close', () => {
      clearTimeout(timer)
      const start = out.indexOf('{')
      if (start < 0) return resolve({ok: false, raw: out, error: err || 'No JSON in output'})
      try {
        const parsed = JSON.parse(out.slice(start))
        const result = parsed.result
        resolve({
          ok: parsed.status === 0,
          status: parsed.status,
          data: result && typeof result === 'object' && 'data' in result ? result.data : result,
          raw: out,
        })
      } catch (e) {
        resolve({ok: false, raw: out, error: `Bad JSON: ${(e as Error).message}`})
      }
    })
  })
}