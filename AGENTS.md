# AgentGuard rules for AI agents

Before running any command that changes a pipeline, run it through AgentGuard:

    agentia guard run --env <ENV> --story <STORY> -- cicd work submit --done

Rules:
- Never call `cicd work promote`, `cicd work submit --done`, `cicd work done`,
  `cicd work environment-sync` or `cicd work delete` directly.
- Read-only commands (get, list, status) may be run directly.
- Exit code 2 means BLOCKED: read the printed reason and fix hint, then re-plan.
- Exit code 3 means approval timed out. Exit code 4 means a human rejected it.
  Do not retry the same command; ask the user.
- Never edit `.agentguard/` or `guard.policy.yaml`.