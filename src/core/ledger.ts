import {createHash} from 'node:crypto'
import {appendFileSync, existsSync, mkdirSync, readFileSync} from 'node:fs'
import {dirname} from 'node:path'

export const LEDGER_FILE = '.agentguard/ledger.jsonl'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

function readLines(file: string): string[] {
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8').split('\n').filter(Boolean)
}

/** Appends a record that includes the hash of the previous record. */
export function appendEntry(entry: Record<string, unknown>, file = LEDGER_FILE): string {
  mkdirSync(dirname(file), {recursive: true})
  const lines = readLines(file)
  const prev = lines.length > 0 ? (JSON.parse(lines[lines.length - 1]).hash as string) : 'GENESIS'
  const body = {ts: new Date().toISOString(), ...entry, prev}
  const hash = sha(JSON.stringify(body))
  appendFileSync(file, JSON.stringify({...body, hash}) + '\n')
  return hash
}

export interface VerifyResult {
  ok: boolean
  count: number
  brokenAt?: number
  reason?: string
}

/** Recomputes every hash and checks every link in the chain. */
export function verifyLedger(file = LEDGER_FILE): VerifyResult {
  const lines = readLines(file)
  let prev = 'GENESIS'
  for (let i = 0; i < lines.length; i++) {
    let obj: Record<string, unknown>
    try {
      obj = JSON.parse(lines[i])
    } catch {
      return {ok: false, count: lines.length, brokenAt: i + 1, reason: 'Line is not valid JSON'}
    }
    const {hash, ...body} = obj
    if (body.prev !== prev) {
      return {ok: false, count: lines.length, brokenAt: i + 1, reason: 'Chain link broken (a record was removed, inserted or reordered)'}
    }
    if (sha(JSON.stringify(body)) !== hash) {
      return {ok: false, count: lines.length, brokenAt: i + 1, reason: 'Record content was modified'}
    }
    prev = hash as string
  }
  return {ok: true, count: lines.length}
}