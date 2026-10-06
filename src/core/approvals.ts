import {randomBytes} from 'node:crypto'
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import type {Finding} from './engine.js'

const DIR = '.agentguard/requests'

export type Status = 'pending' | 'approved' | 'rejected'

export interface ApprovalRequest {
  id: string
  createdAt: string
  actor: string
  command: string
  env: string | null
  story: string | null
  findings: Finding[]
  status: Status
  decidedBy?: string
  decidedAt?: string
  reason?: string
}

const fileFor = (id: string) => `${DIR}/${id}.json`

export function createRequest(
  data: Omit<ApprovalRequest, 'id' | 'createdAt' | 'status'>,
): ApprovalRequest {
  mkdirSync(DIR, {recursive: true})
  const req: ApprovalRequest = {
    ...data,
    id: randomBytes(3).toString('hex'),
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
  writeFileSync(fileFor(req.id), JSON.stringify(req, null, 2))
  return req
}

export function readRequest(id: string): ApprovalRequest | null {
  if (!/^[a-f0-9]+$/.test(id) || !existsSync(fileFor(id))) return null
  return JSON.parse(readFileSync(fileFor(id), 'utf8')) as ApprovalRequest
}

export function decideRequest(
  id: string,
  status: 'approved' | 'rejected',
  by: string,
  reason?: string,
): ApprovalRequest | null {
  const req = readRequest(id)
  if (!req) return null
  if (req.status !== 'pending') return req
  const updated: ApprovalRequest = {...req, status, decidedBy: by, decidedAt: new Date().toISOString(), reason}
  writeFileSync(fileFor(id), JSON.stringify(updated, null, 2))
  return updated
}