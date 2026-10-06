# AgentGuard

Policy guardrails, human approval, and a tamper-evident audit trail
for AI agents that use the Agentia CLI.

## Problem
AI agents can promote and deploy through Agentia. Teams need rules the
agent cannot bypass, and proof of what it did.

## What it does
- `guard check`        dry-run a command against policy
- `guard run`          run a command only if policy allows it
- `guard approve`      approve or reject a paused request
- `guard audit verify` prove the audit log was not altered
- `guard init`         create a starter policy file

## Install
```
git clone https://github.com/YOUR-USERNAME/agentguard.git
cd agentguard
npm install
npm run build
agentia plugins link .
```

## Quick start
```
agentia guard init
agentia guard run --env PROD --day Fri --dry-run -- cicd work submit --done
agentia guard audit verify
```

## How it works
Agent -> guard run -> classify command -> evaluate policy
      -> allow | block | escalate (human approves) -> run
      -> every step appended to a hash-chained ledger

## Policy file
`guard.policy.yaml` defines freeze windows, protected environments,
restricted metadata types, and the decision per action type.

## Exit codes
0 allowed, 2 blocked, 3 approval timed out, 4 rejected.

## Roadmap
Attach evidence to Copado user stories, Slack/Teams approvals,
MCP tool wrapper, shareable policy packs (SOX, regulated finance).