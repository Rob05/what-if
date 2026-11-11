# What If?

A live, room-based version of the What If? party game. Players join a room by QR code or invite link, submit a Question and Answer card, then reveal cards in a shared, mismatched sequence.

## Requirements

- Node.js 22.12 or newer
- npm
- A Cloudflare account for deployment (the app is designed for Workers Free)

## Local development

Install dependencies:

```sh
npm install
```

In one terminal, build the static app and start the local Cloudflare Worker with Durable Objects:

```sh
npm run build
npm run worker:dev
```

In a second terminal, start Vite:

```sh
npm run dev
```

Open the Vite URL printed in the terminal. Vite proxies API and WebSocket requests to Wrangler on port `8787`. To test QR joins from another device on the same network, open the Vite URL using this computer's LAN address.

Wrangler stores local Durable Object state under `.wrangler/`, which is ignored by Git.

## Cloudflare setup and deployment

1. Create or sign in to a Cloudflare account and install project dependencies with `npm install`.
2. Authenticate Wrangler:

   ```sh
   npx wrangler login
   ```

3. Build and deploy the app:

   ```sh
   npm run deploy
   ```

   Wrangler builds a Worker that serves the Vite `dist/` assets and routes `/api/*` requests to a SQLite-backed Durable Object. The configured `v1` migration creates the Durable Object class on first deployment.

4. Open the `*.workers.dev` URL reported by Wrangler. Create a room and scan its QR code or share the invite link.

No external database, QR-code API, or paid third-party service is configured. The app uses Workers Static Assets and SQLite-backed Durable Objects, which are available on Cloudflare Workers Free. Free-plan limits can change; check the current [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) before deployment. On the Free plan, operations that exceed included Durable Objects limits fail rather than being billed as overages. This project does not automatically upgrade the account to a paid plan.

Room links are invitations: anyone with the link can join while the room is between rounds. Players use nicknames rather than accounts, so do not put private information in a nickname or card.

## Game rules and product decisions

- Canonical traditional and online rules: [docs/what-if-game-rules.md](docs/what-if-game-rules.md)
- Online-game interview decisions: [docs/interviews/online-game-requirements.md](docs/interviews/online-game-requirements.md)

## Checks

```sh
npm run lint
npm test
npm run build
npm run deploy:dry-run
```
