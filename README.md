# MacroFactor Workout MCP Server

An MCP (Model Context Protocol) server that lets Claude interact with MacroFactor Workouts — log new workouts, read history, update sessions, and manage training plans.

## Features

| Capability | Details |
|---|---|
| **Log workout** | `create-workout` tool — date, name, exercises with sets/reps/weight/RIR |
| **Update workout** | `update-workout` tool — patch any fields by ID |
| **Delete workout** | `delete-workout` tool |
| **Read history** | `macrofactor://workouts` resource — full list |
| **Read single** | `macrofactor://workouts/{id}` resource |
| **Create plan** | `create-plan` tool — weekly structure with days and exercises |
| **Update plan** | `update-plan` tool |
| **Delete plan** | `delete-plan` tool |
| **Read plans** | `macrofactor://plans` and `macrofactor://plans/{id}` resources |

## Requirements

- Node.js 18+
- A MacroFactor account
- Your Firebase API key (see Setup below)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure credentials

```bash
cp .env.example .env
```

Edit `.env`:

```
MACROFACTOR_EMAIL=you@example.com
MACROFACTOR_PASSWORD=yourpassword
FIREBASE_API_KEY=AIzaSy...          # Firebase Web API Key
FIREBASE_PROJECT_ID=sbs-diet-app    # MacroFactor's Firebase project
```

**Getting your Firebase API Key:**
1. Open [Firebase Console](https://console.firebase.google.com) and find the `sbs-diet-app` project
2. Go to **Project Settings → General → Your apps → Web API Key**

### 3. Build

```bash
npm run build
```

### 4. Connect to Claude Desktop

Add the following to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "macrofactor": {
      "command": "node",
      "args": ["/absolute/path/to/MacroFactor-workout-mcp/dist/server.js"],
      "env": {
        "MACROFACTOR_EMAIL": "you@example.com",
        "MACROFACTOR_PASSWORD": "yourpassword",
        "FIREBASE_API_KEY": "AIzaSy...",
        "FIREBASE_PROJECT_ID": "sbs-diet-app"
      }
    }
  }
}
```

Replace `/absolute/path/to/MacroFactor-workout-mcp` with the actual path on your machine.

Restart Claude Desktop. You can now ask Claude things like:

- *"Log my workout from today — bench press 3×8 at 80kg, squat 4×5 at 100kg"*
- *"Show me my workout history"*
- *"Create a 4-week push/pull/legs plan"*
- *"Update yesterday's workout to change the bench press weight to 85kg"*

## Development

```bash
# Run in dev mode (no build step)
npm run dev

# Inspect tools/resources interactively
npm run inspector
```

## Project Structure

```
src/
├── server.ts              # Entry point
├── config.ts              # Env validation
├── types.ts               # Domain types
├── client/
│   ├── IWorkoutClient.ts  # Interface
│   ├── firebase.ts        # Firebase/Firestore implementation
│   ├── rest.ts            # Generic REST implementation
│   └── factory.ts         # Selects backend via API_BACKEND env var
├── tools/
│   ├── workouts.ts        # create/update/delete workout tools
│   └── plans.ts           # create/update/delete plan tools
└── resources/
    ├── workouts.ts        # workout-history + workout/{id}
    └── plans.ts           # plan-list + plan/{id}
```

## Using a Generic REST Backend

If you have a custom REST API instead of Firebase, set `API_BACKEND=rest` in your `.env`:

```
API_BACKEND=rest
REST_API_BASE_URL=https://api.yourapp.com/v1
REST_API_TOKEN=your_bearer_token
```

The REST client expects standard CRUD endpoints:
- `GET /workouts`, `POST /workouts`, `PATCH /workouts/:id`, `DELETE /workouts/:id`
- `GET /plans`, `POST /plans`, `PATCH /plans/:id`, `DELETE /plans/:id`

## License

MIT
