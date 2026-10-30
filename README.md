# AI Platform

**Your AI. Your Tools. One Platform.**

A multi-provider AI workspace: one conversation surface over twenty AI
providers, a real file library, projects, developer integrations with official
OAuth, and a rich interactive answer renderer — with a visual language built
around the reference art direction (a large central rock mass, cloudy
grey/blue sky, calm natural light, glassmorphism over a charcoal + stone +
calm-blue palette).

---

## What is actually implemented

| Layer | State |
| --- | --- |
| UI (React 18 + TypeScript + Tailwind + Zustand) | ✅ dark & light designed separately, RTL/LTR, mobile-first |
| Auth (Firebase Authentication) | ✅ email/password, Google, reset, verification, delete — real Firebase, **no placeholder accounts** |
| Data (Cloud Firestore + Storage) | ✅ per-user collections guarded by `firestore.rules` / `storage.rules`; falls back to a clearly labelled **local-only** mode when Firebase is not configured |
| AI Provider layer | ✅ 20 providers behind **one adapter interface**; the UI never calls a vendor API |
| Chat + streaming | ✅ SSE from the gateway, normalised into one event protocol |
| Interactive answers | ✅ `ui.*` blocks: forms, sortable tables, charts, steps, tasks, tabs, stats, comparisons, links, images, product/service cards |
| Markdown / code | ✅ GFM + KaTeX, syntax highlighting for 190+ languages, line numbers, collapse, copy/download, HTML/CSS/JS preview, mermaid diagrams |
| Files | ✅ extraction in-browser (PDF/DOCX/XLSX/text) so the model can genuinely read attachments |
| Web search & deep research | ✅ Wikipedia / Wikimedia / DuckDuckGo by default, Serper or Brave when a key is set; sources shown with the answer |
| Image sources | ✅ Wikipedia lead images + Wikimedia Commons **with licence and attribution** — illustration is searched, never invented |
| Image Studio | ✅ only models that really expose image generation/editing |
| Library / Projects | ✅ upload, folders, rename, move, preview, attach-to-chat; per-project instructions, files, models |
| Integrations (50) | ✅ catalogue with OAuth / token / manual flows, Tool Registry with **real** HTTP tools |
| Legal pages + cookie banner | ✅ three real documents in both languages, honest disclaimers |
| Gateway (`/server`) | ✅ Hono Worker + D1, AES-GCM encrypted credentials, model catalogs, chat, images, search, OAuth, tools |

**Deliberately not faked:** a provider shows *connected* only after the vendor
accepted the key; a model only shows a capability the catalog or the vendor
returned; an integration only shows *connected* after its token was validated;
OAuth services without configured client credentials show the exact setup steps
instead of a working-looking button.

---

## Architecture

```
┌─ UI Layer ───────────── src/components, src/pages
│    renders only, no vendor calls
├─ Application Layer ──── src/store (zustand), src/lib
│    chat · providers · projects · settings · workspace (firestore | local)
├─ AI Provider Layer ──── src/ai/types (registry)  ⇄  server/src/providers.ts (adapters)
├─ Capability Registry ── src/ai/capabilities.ts, model.parameters gate the settings form
├─ Integration Layer ──── src/integrations/catalog.ts ⇄ server/src/integrations.ts
├─ Firebase Data Layer ── src/lib/db.ts, src/lib/workspace.ts, src/lib/auth.tsx
└─ Security Layer ─────── firestore.rules · storage.rules · AES-GCM in the gateway
```

Every credential lives in the gateway: the browser sends an opaque client id
(and the Firebase ID token when signed in), never a vendor key.

---

## Local mode (no server)

When `VITE_GATEWAY_URL` is empty the app runs without any backend of its own:

- Provider API keys are stored **encrypted on the user's device only**: AES-256-GCM, with a
  random non-extractable key kept in IndexedDB; only ciphertext is written to `localStorage`.
- The browser calls the provider directly (`src/lib/local/`), so a provider must allow
  browser requests (CORS). OpenRouter, OpenAI, Google, Groq, Mistral, DeepSeek and most
  OpenAI-compatible APIs do; Anthropic is supported through its browser-access header.
  Providers that block browsers (for example Bedrock) report a clear error instead of failing silently.
- Keys do not sync between devices, and service integrations (OAuth) stay disabled because
  their secrets cannot live in a browser. Set `VITE_GATEWAY_URL` to use the server gateway instead.

Limit: encryption at rest protects against storage dumps and casual inspection, but code running
inside the page can still use the vault, so do not add third-party scripts.

## Run it

```bash
# 1. web app
npm install
cp .env.example .env        # fill in Firebase + VITE_GATEWAY_URL if you have them
VITE_ALLOWED_HOSTS=your-preview-host npm run dev   # http://localhost:3000

# 2. gateway
cd server
npm install
cp .dev.vars.example .dev.vars   # GATEWAY_SECRET at minimum
npx wrangler d1 execute ai-platform-gateway --local --file schema.sql
npm run dev                       # http://localhost:8787 (proxied by the app as /gw)
```

Useful scripts: `npm run typecheck`, `npm run build`, `cd server && npm run
typecheck`.

### Gateway environment

See [`server/.dev.vars.example`](server/.dev.vars.example). The variables are:

| Variable | Purpose |
| --- | --- |
| `GATEWAY_SECRET` | derives the AES-GCM key for stored credentials (required) |
| `APP_ORIGIN`, `ALLOWED_ORIGIN` | OAuth return URL and CORS origin |
| `FIREBASE_PROJECT_ID` | enables signature-verified ID tokens (per-user scoping) |
| `SERPER_API_KEY` / `BRAVE_API_KEY` | full web index; otherwise keyless sources are used |
| `GITHUB_CLIENT_ID/SECRET`, … | one pair per OAuth service you actually want to connect |

Provider API keys are **entered in the app** (Providers → Connect), encrypted by
the gateway and never returned, logged or written to the browser.

### Firebase

1. Create a project, enable **Authentication** (Email/Password + Google),
   **Firestore** and **Storage**.
2. Copy the web config into `.env` as `VITE_FIREBASE_*`.
3. Deploy the rules: `firebase deploy --only firestore:rules,storage`.
4. Without any of this the app still runs — in a permanent, honest
   *setup required* state with browser-local data.

---

## Connect flow (why some buttons ask for setup)

* **OAuth (24 services)** — click Connect → official vendor consent screen →
  return connected. Requires that service's `*_CLIENT_ID/SECRET` on the gateway.
* **Token (21 services)** — the vendor only issues personal tokens; the gateway
  validates the token against the vendor API *before* reporting connected.
* **Manual (5 services)** — the vendor needs an admin-approved app or account
  credentials; the card lists the exact steps instead of pretending.

The Tool Registry exposes real operations (`list_repos`, `get_file`,
`list_issues`, `create_issue`, `create_pr`, GitLab pipelines, Linear/Notion
search, Sentry issues, Slack search, Vercel deployments, Drive search, …).
Sensitive tools are marked and must be confirmed by the user before they run.

---

## Verified limitations

* `Amazon Bedrock` chat works with a signed `invoke` call (non-streaming, since
  the event-stream format is not decoded here); its **model catalog is not**
  listed — the gateway returns an explicit message for that.
* Streaming, model listing and image generation are untested against live keys
  in this environment (no credentials available); the adapters follow each
  vendor's documented protocol and surface the vendor's own error text.
* Interactive browser checks (sign-in, two-account isolation) require a real
  Firebase project and are pending until one is configured.

---

<p align="center">Your AI. Your Tools. One Platform.</p>
