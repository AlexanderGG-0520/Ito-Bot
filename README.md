# Ito Bot

Ito Bot is a TypeScript Discord bot for playing the cooperative number-ordering game Ito in a Discord channel. It uses a newly created Discord application; no old application, token, client ID, invite, or support links are included.

## Rules and commands

Games are independent per guild and channel. The current rules are specified in [docs/game-model.md](docs/game-model.md) and summarized from the [official Ito product page](https://arclightgames.jp/product/ito/).

| Command                           | Purpose                                                                   |
| --------------------------------- | ------------------------------------------------------------------------- |
| `/theme topic:<theme>`            | Set the guild's theme (`Mahjong`, `Easy`, `Normal`, or `Hard`).           |
| `/start`                          | Create a channel lobby; the author joins automatically.                   |
| `/join`                           | Join a lobby before its first stage.                                      |
| `/leave`                          | Leave the current game.                                                   |
| `/begin`                          | Start stage 1 from the lobby (creator only).                              |
| `/nextstage`                      | Prepare the next stage after the current stage is cleared (creator only). |
| `/declare card:<1-3> clue:<text>` | Publicly declare the card slot shown by `/hand`.                          |
| `/momo declaration:<text>`        | Set the shared public Momo declaration during stage 3.                    |
| `/hand`                           | Privately show your hand and its player-local card slots.                 |
| `/play card:<number>`             | Play an owned card.                                                       |
| `/reveal`                         | Show the current public pile.                                             |
| `/end`                            | Let the lobby creator cancel the game or report its result.               |
| `/help`                           | Show paginated help.                                                      |

## Requirements and local setup

Use Node.js 22 LTS or newer.

```sh
cp .env.example .env
# edit .env with the new application values
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Required environment variables are `DISCORD_TOKEN` and `DISCORD_CLIENT_ID`. `DISCORD_GUILD_ID` is optional: when set, registration is guild-scoped; otherwise commands are registered globally. `PORT` defaults to `8080`, `HOST` to `0.0.0.0`, `NODE_ENV` to `development`, `LOG_LEVEL` to `info`, and `DATA_DIR` to `/tmp/ito-bot`. `TERMS_URL`, `PRIVACY_URL`, and `SUPPORT_URL` are optional valid HTTPS URLs; the bot only creates buttons for configured valid values. The current runtime does not write to `DATA_DIR`, but it remains available for a future persistence implementation.

Run `npm run register-commands` separately after building. It only calls Discord's application-command REST endpoint and never connects to the Gateway. The bot runtime does not register commands on startup.

## Create a new Discord application

1. Open the Discord Developer Portal and create a new application.
2. On **Bot**, create a new bot user and copy its token into `DISCORD_TOKEN`. Treat it as a secret and never commit it.
3. On **General Information**, copy the Application ID into `DISCORD_CLIENT_ID`.
4. For development, set `DISCORD_GUILD_ID` to a test server ID. Remove it for global registration.
5. Create an OAuth2 URL with the `bot` and `applications.commands` scopes. Grant only the permissions needed by the commands: View Channel, Send Messages, Embed Links, and Read Message History.
6. No privileged Gateway intents are required. The bot requests only the `Guilds` intent.
7. Invite the new bot with that URL and run command registration.

## Docker

The image is multi-stage, runs as the non-root `node` user, contains only production dependencies and compiled output, and does not require a writable application directory.

```sh
docker build -t ito-bot:local .
docker run --rm --read-only -p 8080:8080 \
  -e DISCORD_TOKEN='REPLACE_ME' \
  -e DISCORD_CLIENT_ID='REPLACE_ME' \
  ito-bot:local
```

The GHCR image name is `ghcr.io/alexandergg-0520/ito-bot`. CI publishes immutable `sha-...` tags and semantic-version tags. Kubernetes must use a commit SHA tag or digest, never `latest`.

## CI and deployment

Pull requests and pushes to `master` run formatting, lint, type checking, tests, the TypeScript build, and a Docker build. The publish workflow pushes to GHCR on `master`, `v*` tags, or manual dispatch using `GITHUB_TOKEN`.

The plain Kustomize base is under `deploy/k8s/base`:

```sh
kubectl kustomize deploy/k8s/base
```

Replace the image placeholder with an immutable published SHA tag. Create the secret out of band; never commit its YAML:

```sh
kubectl create namespace ito-bot
kubectl -n ito-bot create secret generic ito-bot-secrets \
  --from-literal=DISCORD_TOKEN='REPLACE_ME' \
  --from-literal=DISCORD_CLIENT_ID='REPLACE_ME' \
  --dry-run=client -o yaml
```

The Deployment has one replica and `Recreate` strategy because game state is in memory. It uses `/healthz` for liveness and `/readyz` for readiness, a read-only root filesystem, no ServiceAccount token, dropped capabilities, and no external network exposure. The registration Job is an Argo CD `PreSync` hook with bounded retries and uses the same image and Secret.

The Argo CD file at `deploy/argocd/application.example.yaml` is intentionally an example. Replace its private GitOps repository URL, existing branch, path, and Argo CD Project according to the organization's existing GitOps conventions. This repository does not contain a GitOps repository or a live cluster, so no Application was applied.

## Operations

`GET /healthz` returns 200 while the process is alive and not shutting down. `GET /readyz` returns 200 only after configuration, command loading, and the Discord `ready` event succeed. SIGINT and SIGTERM stop the health server, clear status updates, destroy the Discord client, and exit cleanly. Uncaught exceptions and unhandled rejections are logged without secrets and terminate the process so Kubernetes can restart it.

The initial deployment intentionally uses in-memory state. A Pod restart, replacement, or scale-down loses active games and guild theme selections. Keep exactly one replica until a persistence design is introduced. Discord interactions are handled synchronously at the domain boundary, preventing overlapping state mutations in the single Node.js event loop.

### Official gameplay mapping

The deck is numbered 1–100. Stage 1/2/3 deal 1/2/3 cards per player. A play removes that card from its owner's private hand; all remaining cards lower than it are skipped and cost one life each, while the public pile and stage continue. Stage 3 exposes one separate Momo card and uses `/momo` for the group's shared declaration. Three lives are shared; only games with at least three players recover one life between stages, capped at three. A stage requires empty hands and remaining lives; zero lives loses even if the final play also empties every hand.

Each hand card has a stable player-local slot shown by `/hand` as `カード1`,
`カード2`, or `カード3`. Use `/declare card:<1-3> clue:<text>`; the slot is
resolved against the invoking player's current hand and declarations are still
stored against the internal card identity. Stage 1 requires one declaration per
player, stage 2 requires two per player, and stage 3 requires three per player.
A declaration can be revised by its owner; played or skipped cards no longer
need an active declaration. Card play is blocked until every currently held card
has a declaration. Direct numeric declarations are rejected
by the bot without revealing the hidden number; numbers spoken in voice chat or
encoded in natural language remain socially enforced because the bot does not
monitor conversations.

After a stage is cleared, the game enters an explicit waiting state. Only
`/nextstage` can advance it, exactly once, and every next stage rebuilds a full
1–100 deck. Stage 1 begins with `/begin`; `/nextstage` is never a lobby command.
Momo has a separate shared declaration and is not part of hand completion.

## Troubleshooting and upgrades

- Missing configuration: verify `DISCORD_TOKEN` and `DISCORD_CLIENT_ID`; values are never printed by the bot.
- Commands missing: run `npm run build` and `npm run register-commands`; use a guild ID for fast development updates.
- `/readyz` is 503: inspect logs for configuration or Gateway login errors; a Gateway reconnect does not make `/healthz` fail.
- Container cannot write: this is expected; the image and manifest are designed for a read-only root filesystem.
- Active games disappeared: the current state strategy is in-memory and restarts are a known limitation.

For an upgrade, publish a new immutable SHA image, update the GitOps repository, let Argo CD run the registration hook, and monitor `/readyz`. Roll back by restoring the prior immutable image tag and GitOps revision. Do not reuse the old Discord credentials or application.
