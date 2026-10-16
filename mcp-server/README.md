# Deep Impression Desk — MCP Server

Lets an MCP-compatible LLM client (Claude Desktop, Cursor, etc.) read and manage tasks, clients, and
projects on the [Deep Impression Desk](https://desk.your-domain.example) portal — with the same
permissions as your own account.

It's a thin wrapper: every tool call goes through the portal's normal REST API, so every business rule
(one-step status transitions, blocked-task checks, dependency-cycle rejection, notifications) is enforced
exactly as it is in the browser. Nothing talks to the database directly.

## Setup

1. **Generate a token** in the portal: go to **Settings → Connect LLM → New Token**. Copy it immediately —
   it's shown once.

2. **Build this server:**
   ```bash
   cd mcp-server
   npm install
   npm run build
   ```

3. **Point your LLM client at it.** For Claude Desktop, add to `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "deep-impression-desk": {
         "command": "node",
         "args": ["/absolute/path/to/Internal_Portal/mcp-server/dist/index.js"],
         "env": {
           "DESK_API_URL": "https://desk.your-domain.example",
           "DESK_API_TOKEN": "dip_..."
         }
       }
     }
   }
   ```
   Restart the client afterward. Other MCP clients (Cursor, etc.) use the same `command`/`args`/`env` shape
   in their own config file.

## Tools

| Tool | Purpose |
|---|---|
| `list_tasks` | List/filter tasks and bugs (status, priority, assignee, client, project, team, blocked, search) |
| `get_task` | Full detail on one task, including dependencies and history |
| `list_clients` / `list_projects` / `list_employees` | Reference data for the other tools |
| `create_task` | Create a task or bug, optionally with dependencies |
| `update_task_status` | Move a task through the pipeline (enforces transition rules server-side) |
| `assign_task` | Assign/unassign |
| `update_task` | Edit title, description, priority, due date, client/project/team/phase, gate flag |
| `add_task_dependency` / `remove_task_dependency` | Manage dependencies (cycle-checked server-side) |
| `add_comment` | Post a comment on a task |
| `list_announcements` / `create_announcement` | Read and post company-wide announcements (create is Admin only) |
| `list_wiki_articles` / `create_wiki_article` / `update_wiki_article` | Read, create, and edit Company Wiki articles (create/update are Admin only) |
| `list_polls` / `create_poll` / `vote_poll` | Read polls, create one (Admin only), and cast the token owner's vote |
| `get_team_timeline` | Monthly attendance timeline for the team: per-person summary + planned leave, early/late notices and absences (Admin only) |
| `get_heads_up` | Upcoming planned leave and "leaving early / coming in late" notices (admins see everyone, others only their own) |
| `give_attendance_notice` / `cancel_attendance_notice` | Tell admins the token owner will leave early or arrive late (or take that back) |
| `set_attendance_mode` | Mark someone as `ANYWHERE` (no clock-in needed, never absent — e.g. founders) or `CLOCK_IN` (Admin only) |
| `list_holidays` / `set_holidays` / `update_holiday` / `delete_holiday` | Read the company holiday calendar; add, update, replace or remove holidays (changes are Admin only and notify everyone) |
| `accept_task` / `mark_task_part` / `set_task_people` | Shared work: accept a task offered to a group (first wins), tick your own part of a together task (moves to review when all are done), or change who is on a task. `create_task` also takes `assignMode` + `people` |
| `list_meta_accounts` / `get_meta_ads_summary` / `map_meta_account` / `sync_meta_account` | Meta Ads (Admin only): see tracked ad accounts, read spend/results/cost-per-result and top campaigns for any range or client, link an account to a client or switch it on/off, and trigger a sync |

## Notes

- A token acts as the employee who generated it — it sees and can do exactly what they can in the app
  (e.g. only admins can skip pipeline stages).
- Revoke a token any time from **Settings → Connect LLM** — it takes effect immediately.
- This server uses stdio transport, so it runs as a local child process of your LLM client. It is not
  deployed anywhere; each person who wants LLM access builds and runs their own copy locally, authenticated
  with their own token.
