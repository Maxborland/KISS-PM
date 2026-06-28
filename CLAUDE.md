# CLAUDE.md

Claude Code: the canonical operating rules for this repo live in **[AGENTS.md](./AGENTS.md)** — follow it as written (same rules every agent here follows). The points below are MANDATORY and called out because they are easy to skip.

## CodeGraph — before & after every code task (see AGENTS.md §8)

A local CodeGraph index lives at `.codegraph/codegraph.db` (MCP `@colbymchenry/codegraph` — tree-sitter + SQLite symbol/relation graph, no external API).

- **Before** any code task (reading, changing, or reviewing source / routes / API / tests / module architecture): **enter the area through CodeGraph, not broad grep.** Use `codegraph_search`, `codegraph_context`, `codegraph_explore`, `codegraph_callers`/`codegraph_callees`, and `codegraph_impact` (before edits). Run `codegraph sync` first (`codegraph init -i` if there is no index).
  - Do NOT start with repo-wide grep/glob/read for **structural** questions ("where is X defined", "who calls X", "what breaks if I change X", "how is this module wired") when `codegraph_*` is available.
- **After** the task, before claiming it done: **mandatory index of changes.** Run `codegraph sync` and include a **change index** in the final report — files touched + symbols added/changed/removed, and CodeGraph nodes/edges before→after.
- **Fallback (allowed, must be disclosed):** plain grep/read is fine only for literal strings, comments, logs, configs outside the graph, or when `codegraph_*` returns nothing / is unavailable. State the fallback explicitly in the report.

> If the CodeGraph MCP is not connected to the current Claude Code session (no `codegraph_*` tools) and no `codegraph` CLI is installed, say so up front, use the grep/read fallback, and STILL produce a manual change index. To restore full compliance, wire CodeGraph into Claude Code via `.mcp.json` (server: `codegraph serve --mcp --path <workspace>`) — it is currently configured for Cursor, not Claude Code.

## Other must-follow from AGENTS.md
- Russian for all user-facing communication (§2).
- Small verifiable slice → targeted verification → final report in the §9 format (which now includes the CodeGraph change index).
- Honesty discipline: no fake controls; preview→apply; prototype-vs-real markers.
