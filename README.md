# Files — password-gated upload on Bunny.net

Minimal private file uploader. One page, one password gate, files stored in
Bunny.net Edge Storage and served via Bunny CDN. Runs on **Cloudflare Workers**
via the OpenNext adapter.

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in values below
npm run dev                  # http://localhost:3000
```

`.env.local`:

```ini
BUNNY_STORAGE_ZONE=store-db
BUNNY_STORAGE_PASSWORD=xxxx
BUNNY_STORAGE_ENDPOINT=https://sg.storage.bunnycdn.com
BUNNY_CDN_HOSTNAME=https://your-zone.b-cdn.net
MASTER_PASSWORD=200431
```

## How it works

- `/` shows a password box. The password is checked server-side
  (`x-master-password` header vs `MASTER_PASSWORD`).
- `GET /api/files` — lists files at the storage zone root.
- `POST /api/files` — uploads `files[]` (multipart) to the zone root.
- `DELETE /api/files?file=name` — deletes a file.
- Public download links: `{CDN}/{fileName}`.

## Deploy to Cloudflare Workers

This repo is pre-configured with `@opennextjs/cloudflare`
(`wrangler.jsonc`, `open-next.config.ts`).

**Secrets** (never commit these — set them in Cloudflare):

```bash
npx wrangler secret put BUNNY_STORAGE_ZONE
npx wrangler secret put BUNNY_STORAGE_PASSWORD
npx wrangler secret put BUNNY_STORAGE_ENDPOINT
npx wrangler secret put BUNNY_CDN_HOSTNAME
npx wrangler secret put MASTER_PASSWORD
```

**Option A — CLI:**

```bash
npm run deploy   # builds with OpenNext + deploys to Workers
npm run preview  # local preview in the Workers runtime (uses .dev.vars)
```

**Option B — Workers Builds (git push to deploy):**
Connect the GitHub repo in Cloudflare Dashboard → Workers & Pages →
Create → Workers → import `archive`, then set:

- Build command: `npx opennextjs-cloudflare build`
- Deploy command: `npx opennextjs-cloudflare deploy`
- Variables + Secrets: `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_PASSWORD`,
  `BUNNY_STORAGE_ENDPOINT`, `BUNNY_CDN_HOSTNAME`, `MASTER_PASSWORD`
