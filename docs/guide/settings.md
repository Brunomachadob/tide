# Settings

Press `s` from the task list to open the Settings screen.

Dates are displayed using your system locale and timezone — no configuration needed.

## Settings file

Settings are stored in `~/.tide/settings.json`. You can edit this file directly — changes take effect on the next poll cycle.

::: warning Atomic writes
Tide writes settings atomically (temp-then-rename). Avoid holding the file open while Tide is running.
:::

## Profiles {#profiles}

Profiles live in `settings.json` under `profiles` — a map of profile names to their config. Each profile declares which agent to use and, optionally, how to authenticate. Task frontmatter references a profile by name.

The onboarding screen sets up minimal profiles on first launch. To add, edit, or remove profiles later, edit `~/.tide/settings.json` directly — changes take effect on the next run.

```json
{
  "profiles": {
    "my-claude": {
      "agent": "claude-code"
    },
    "my-copilot": {
      "agent": "copilot"
    }
  }
}
```

```yaml
# in task frontmatter
profile: my-claude
```

### Profile fields

| Field | Description |
|-------|-------------|
| `agent` | Which agent plugin to use. See [Agents](#agents) below. |
| `model` | Optional model override. Format depends on the agent (e.g. Bedrock ARN for `claude-code`, model name for `gemini`). |
| `auth` | Optional auth config. Shape depends on `auth.type`. See [Auth types](#auth-types) below. |
| `env` | Optional environment variables injected at runtime into every task that uses this profile. Task-level `env` takes precedence. Changes take effect on the next run — no sync required. |

```json
{
  "profiles": {
    "my-claude": {
      "agent": "claude-code",
      "env": {
        "CLAUDE_BIN": "claude"
      }
    }
  }
}
```

### Agents

:::tabs key:agent
== Claude Code

Runs Claude Code via the `@anthropic-ai/claude-agent-sdk`. No `auth` block is needed for local use — authenticate once with `claude /login` or set `ANTHROPIC_API_KEY`, and Tide picks up those credentials automatically.

```json
{
  "profiles": {
    "my-claude": {
      "agent": "claude-code"
    }
  }
}
```

An `auth` block is only required when credentials must be injected at run time (e.g. AWS Bedrock via Teleport — see [`tsh`](#tsh) below).

```json
{
  "profiles": {
    "my-claude-bedrock": {
      "agent": "claude-code",
      "model": "arn:aws:bedrock:eu-central-1:...",
      "auth": {
        "type": "tsh",
        "auth": "okta",
        "app": "my-tsh-app",
        "awsRole": "bedrock-developer-user",
        "teleportProxy": "teleport.example.com:443"
      }
    }
  }
}
```

== Copilot

Runs agents via the [GitHub Copilot SDK](https://github.com/github/copilot-sdk). Requires the Copilot CLI (`@github/copilot`) to be installed and authenticated.

```json
{
  "profiles": {
    "my-copilot": {
      "agent": "copilot",
      "model": "claude-sonnet-4-5"
    }
  }
}
```

**Auth fields (all optional)**

| Field | Description |
|-------|-------------|
| `githubToken` | GitHub token. Falls back to `GH_TOKEN` / `GITHUB_TOKEN` env vars, then stored CLI credentials. |
| `model` | Model name (e.g. `gpt-4o`, `claude-sonnet-4-5`). Defaults to Copilot's default. |
| `provider` | BYOK provider config `{ type, baseUrl, apiKey }` for non-GitHub models. |

== Gemini

Runs agents via the [Vercel AI SDK](https://sdk.vercel.ai/) with the [`ai-sdk-provider-gemini-cli`](https://github.com/ben-vargas/ai-sdk-provider-gemini-cli) provider. Supports OAuth (default), API key, and Vertex AI auth.

For OAuth, authenticate once with the Gemini CLI: `npx @google/gemini-cli` then follow the setup flow — credentials are saved to `~/.gemini/oauth_creds.json`. No `auth` block is needed — OAuth is the default.

```json
{
  "profiles": {
    "my-gemini": {
      "agent": "gemini",
      "model": "gemini-2.5-pro"
    }
  }
}
```

An `auth` block is only required for API key or Vertex AI auth:

```json
{
  "profiles": {
    "my-gemini-apikey": {
      "agent": "gemini",
      "model": "gemini-2.5-pro",
      "auth": {
        "type": "gemini",
        "authType": "api-key",
        "apiKey": "your-api-key"
      }
    }
  }
}
```

**Auth fields**

| Field | Description |
|-------|-------------|
| `authType` | `oauth-personal` (default), `api-key`, or `vertex-ai`. |
| `apiKey` | Required when `authType` is `api-key`. |
| `vertexAI` | `{ projectId, location }` object. Required when `authType` is `vertex-ai`. |

:::

### Auth types {#auth-types}

The `auth` block in a profile is optional. When present, `auth.type` determines how credentials are obtained before the agent runs.

#### `tsh` {#tsh}

Wraps agent execution in [`tsh aws`](https://goteleport.com/docs/application-access/cloud-apis/aws-cli/) to inject temporary AWS credentials and a proxy into the environment. Use this when your model is hosted on AWS Bedrock and access is brokered via Teleport.

| Field | Description |
|-------|-------------|
| `type` | `tsh` |
| `auth` | Auth provider passed to `tsh aws --auth` (e.g. `okta`). |
| `app` | Teleport application name passed to `tsh aws --app`. |
| `awsRole` | AWS role passed to `tsh aws --aws-role`. |
| `teleportProxy` | Teleport proxy address passed to `tsh aws --proxy`. |

`tsh` injects `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `HTTPS_PROXY` into the agent process environment. The agent-runner validates these are present before starting the run.


