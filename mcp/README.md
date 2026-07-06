# GHOST MCP Server

Exposes the GHOST OSINT CRM API as [Model Context Protocol](https://modelcontextprotocol.io) tools, so any MCP-compatible LLM client (Claude Desktop, Claude Code, etc.) can read and write GHOST data directly — search people, create transactions, pull ledgers, add travel history, and everything else the API offers.

## How it works

At startup the server logs into GHOST, fetches the API's own OpenAPI document (`GET /api/openapi.json`), and generates one MCP tool per endpoint — request schemas, required fields, enums and all. **There are no hand-maintained tool definitions**: whatever the running GHOST instance supports is what the LLM sees. Upgrading GHOST automatically upgrades the toolset.

Tool names follow the pattern `ghost_<verb>_<resource>`:

| Tool | Endpoint |
|---|---|
| `ghost_get_people` | `GET /api/people` |
| `ghost_get_people_by_id` | `GET /api/people/{id}` |
| `ghost_create_people` | `POST /api/people` |
| `ghost_create_transactions` | `POST /api/transactions` |
| `ghost_get_ledger` | `GET /api/{entityType}/{id}/ledger` |
| `ghost_get_businesses_venue_stats` | `GET /api/businesses/{id}/venue-stats` |

…and ~45 more, covering the full API surface.

### Duplicate protection

`ghost_create_people` and `ghost_create_businesses` check for existing records with the same name (or alias) before creating, and refuse with a list of matches if any are found. The LLM can retry with `ignorePossibleDuplicates: true` when it has verified the record is genuinely new. This guards against the common failure mode where an LLM inserts without searching first.

### Session handling

The server logs in with the configured credentials, holds the session cookie, and transparently re-authenticates if the session expires mid-conversation.

## Setup

Requires Node.js ≥ 18 and a running GHOST instance (v2.8+, which serves `/api/openapi.json`).

```bash
cd mcp
npm install
```

### Claude Code

```bash
claude mcp add ghost \
  --env GHOST_API_URL=http://localhost:3001/api \
  --env GHOST_USERNAME=youruser \
  --env GHOST_PASSWORD=yourpassword \
  -- node /path/to/GHOST-osint-crm/mcp/ghost-mcp.js
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ghost": {
      "command": "node",
      "args": ["/path/to/GHOST-osint-crm/mcp/ghost-mcp.js"],
      "env": {
        "GHOST_API_URL": "http://localhost:3001/api",
        "GHOST_USERNAME": "youruser",
        "GHOST_PASSWORD": "yourpassword"
      }
    }
  }
}
```

## Configuration

| Env var | Default | Description |
|---|---|---|
| `GHOST_API_URL` | `http://localhost:3001/api` | Base URL of the GHOST backend API |
| `GHOST_USERNAME` | — (required) | GHOST login username |
| `GHOST_PASSWORD` | — (required) | GHOST login password |

Consider creating a dedicated non-admin GHOST user for the LLM: admin-only endpoints (users, audit logs, settings writes) will then return 403, which the tool descriptions flag with "(admin only)".

## Credits

Session handling and the duplicate-detection pattern are adapted from [@zbyte64](https://github.com/zbyte64)'s original `ghost-mcp.js` implementation shared in [issue #44](https://github.com/elm1nst3r/GHOST-osint-crm/issues/44).
