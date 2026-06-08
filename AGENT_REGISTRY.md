# AIMS — Agent Registry

## How Agents Work in This Project

The **Orchestrator** is the main Claude Code session.
It reads PROGRESS.md, decides what to build next, and delegates to subagents.
Subagents report back; the orchestrator updates PROGRESS.md checkboxes.

Subagents NEVER modify CLAUDE.md or AGENT_REGISTRY.md.
Only the orchestrator and the user may do so.

---

## Registered Agents

| Agent File | Name | Model | Memory | Triggered When |
|---|---|---|---|---|
| `agents/orchestrator.md` | orchestrator | opus | project | Session start, phase transitions |
| `agents/schema-builder.md` | schema-builder | sonnet | project | Phase 1: DB schema + migrations |
| `agents/ui-builder.md` | ui-builder | sonnet | project | Any component/page build task |
| `agents/api-builder.md` | api-builder | sonnet | project | Any API route or server action |
| `agents/finance-engine.md` | finance-engine | sonnet | project | Cost/profit calculations, formulas |
| `agents/doc-manager.md` | doc-manager | sonnet | project | Document upload, Supabase Storage |
| `agents/importer.md` | importer | sonnet | project | Excel import, data mapping |
| `agents/qa-reviewer.md` | qa-reviewer | opus | project | After each phase completes |
| `agents/deploy-agent.md` | deploy-agent | haiku | none | Phase 9 only: Vercel + Supabase prod |

---

## Agent Trigger Map

```
User: "start the project" or "begin phase 1"
  → orchestrator reads PROGRESS.md
  → orchestrator invokes schema-builder (Phase 1 tasks)
  → orchestrator invokes ui-builder (layout shell)
  → qa-reviewer validates Phase 1
  → orchestrator marks Phase 1 ✅, starts Phase 2

User: "build the container tracker"
  → orchestrator invokes ui-builder (container list + detail page)
  → orchestrator invokes api-builder (API routes)
  → qa-reviewer checks completeness

User: "add document upload"
  → orchestrator invokes doc-manager

User: "build the profit calculations"
  → orchestrator invokes finance-engine

User: "import the excel"
  → orchestrator invokes importer

User: "deploy" or "go live"
  → qa-reviewer runs final checks
  → deploy-agent runs Vercel + DB migration steps

After ANY code change:
  → qa-reviewer automatically reviews (triggered by orchestrator)
```
