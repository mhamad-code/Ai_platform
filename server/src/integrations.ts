/**
 * Integration layer.
 *
 *  - OAuth 2.0 authorization-code (PKCE where the vendor supports it) using
 *    client credentials that live only in the gateway environment.
 *  - Personal-access-token services, validated against the vendor API before a
 *    connection is ever reported as "connected".
 *  - A Tool Registry: every connected service exposes named tools that the
 *    assistant can call. Sensitive tools must be confirmed by the user.
 *
 * Nothing here is a mock: every `run` performs a real HTTPS request.
 */

import { decrypt, encrypt } from './crypto';

export type Env = Record<string, string | undefined>;

export interface OAuthService {
  authorizeUrl: string;
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv?: string;
  scopes: string;
  pkce?: boolean;
  apiBase?: string;
}

/* --------------------------- OAuth catalogue ---------------------------- */

export const OAUTH_SERVICES: Record<string, OAuthService> = {
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
    scopes: 'repo read:user',
    apiBase: 'https://api.github.com',
  },
  gitlab: {
    authorizeUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'https://gitlab.com/oauth/token',
    clientIdEnv: 'GITLAB_CLIENT_ID',
    clientSecretEnv: 'GITLAB_CLIENT_SECRET',
    scopes: 'read_api api',
    apiBase: 'https://gitlab.com/api/v4',
  },
  bitbucket: {
    authorizeUrl: 'https://bitbucket.org/site/oauth2/authorize',
    tokenUrl: 'https://bitbucket.org/site/oauth2/access_token',
    clientIdEnv: 'BITBUCKET_CLIENT_ID',
    clientSecretEnv: 'BITBUCKET_CLIENT_SECRET',
    scopes: 'account repositories pullrequest',
    apiBase: 'https://api.bitbucket.org/2.0',
  },
  codeberg: {
    authorizeUrl: 'https://codeberg.org/login/oauth/authorize',
    tokenUrl: 'https://codeberg.org/login/oauth/access_token',
    clientIdEnv: 'CODEBERG_CLIENT_ID',
    clientSecretEnv: 'CODEBERG_CLIENT_SECRET',
    scopes: 'read:user repository',
    apiBase: 'https://codeberg.org/api/v1',
  },
  slack: {
    authorizeUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    clientIdEnv: 'SLACK_CLIENT_ID',
    clientSecretEnv: 'SLACK_CLIENT_SECRET',
    scopes: 'search:read,chat:write,channels:read',
    apiBase: 'https://slack.com/api',
  },
  discord: {
    authorizeUrl: 'https://discord.com/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    clientIdEnv: 'DISCORD_CLIENT_ID',
    clientSecretEnv: 'DISCORD_CLIENT_SECRET',
    scopes: 'identify guilds',
    apiBase: 'https://discord.com/api/v10',
  },
  notion: {
    authorizeUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    clientIdEnv: 'NOTION_CLIENT_ID',
    clientSecretEnv: 'NOTION_CLIENT_SECRET',
    scopes: '',
    apiBase: 'https://api.notion.com/v1',
  },
  figma: {
    authorizeUrl: 'https://www.figma.com/oauth',
    tokenUrl: 'https://www.figma.com/api/oauth/token',
    clientIdEnv: 'FIGMA_CLIENT_ID',
    clientSecretEnv: 'FIGMA_CLIENT_SECRET',
    scopes: 'file_read',
    apiBase: 'https://api.figma.com',
  },
  trello: {
    authorizeUrl: 'https://trello.com/1/authorize',
    tokenUrl: 'https://trello.com/1/oauth/token',
    clientIdEnv: 'TRELLO_CLIENT_ID',
    clientSecretEnv: 'TRELLO_CLIENT_SECRET',
    scopes: 'read,write',
    apiBase: 'https://api.trello.com/1',
  },
  jira: {
    authorizeUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    clientIdEnv: 'ATLASSIAN_CLIENT_ID',
    clientSecretEnv: 'ATLASSIAN_CLIENT_SECRET',
    scopes: 'read:jira-work write:jira-work',
    apiBase: 'https://api.atlassian.com',
  },
  gdrive: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
    scopes: 'https://www.googleapis.com/auth/drive.readonly',
    apiBase: 'https://www.googleapis.com/drive/v3',
  },
  linear: {
    authorizeUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    clientIdEnv: 'LINEAR_CLIENT_ID',
    pkce: true,
    scopes: 'read write',
    apiBase: 'https://api.linear.app',
  },
  vercel: {
    authorizeUrl: 'https://vercel.com/oauth/authorize',
    tokenUrl: 'https://api.vercel.com/v2/oauth/token',
    clientIdEnv: 'VERCEL_CLIENT_ID',
    clientSecretEnv: 'VERCEL_CLIENT_SECRET',
    scopes: 'project:read deployment:read',
    apiBase: 'https://api.vercel.com',
  },
  netlify: {
    authorizeUrl: 'https://app.netlify.com/authorize',
    tokenUrl: 'https://api.netlify.com/oauth/token',
    clientIdEnv: 'NETLIFY_CLIENT_ID',
    clientSecretEnv: 'NETLIFY_CLIENT_SECRET',
    scopes: 'sites',
    apiBase: 'https://api.netlify.com',
  },
  sentry: {
    authorizeUrl: 'https://sentry.io/oauth/authorize',
    tokenUrl: 'https://sentry.io/oauth/token',
    clientIdEnv: 'SENTRY_CLIENT_ID',
    clientSecretEnv: 'SENTRY_CLIENT_SECRET',
    scopes: 'event:read project:read',
    apiBase: 'https://sentry.io/api/0',
  },
  webflow: {
    authorizeUrl: 'https://webflow.com/oauth/authorize',
    tokenUrl: 'https://api.webflow.com/oauth/token',
    clientIdEnv: 'WEBFLOW_CLIENT_ID',
    clientSecretEnv: 'WEBFLOW_CLIENT_SECRET',
    scopes: 'sites:read cms:read',
    apiBase: 'https://api.webflow.com/v2',
  },
  sourcehut: {
    authorizeUrl: 'https://meta.sr.ht/oauth/authorize',
    tokenUrl: 'https://meta.sr.ht/oauth/token',
    clientIdEnv: 'SOURCEHUT_CLIENT_ID',
    clientSecretEnv: 'SOURCEHUT_CLIENT_SECRET',
    scopes: 'issue:read meta:read',
    apiBase: 'https://git.sr.ht/api',
  },
  cloudflare: {
    authorizeUrl: 'https://dash.cloudflare.com/oauth2/authorize',
    tokenUrl: 'https://dash.cloudflare.com/oauth2/token',
    clientIdEnv: 'CLOUDFLARE_CLIENT_ID',
    clientSecretEnv: 'CLOUDFLARE_CLIENT_SECRET',
    scopes: 'account:read',
    apiBase: 'https://api.cloudflare.com/client/v4',
  },
};

/** Services that take a token: env var that holds the service's client secret, if any. */
export const TOKEN_SERVICES: Record<string, { validate: string; method?: string; headers?: Record<string, string> }> = {
  github: { validate: 'https://api.github.com/user', headers: { Accept: 'application/vnd.github+json' } },
  huggingface: { validate: 'https://huggingface.co/api/whoami-v2' },
  vercel: { validate: 'https://api.vercel.com/v2/user' },
  stripe: { validate: 'https://api.stripe.com/v1/balance' },
  supabase: { validate: 'https://api.supabase.com/v1/projects' },
  sentry: { validate: 'https://sentry.io/api/0/organizations/' },
  posthog: { validate: 'https://us.posthog.com/api/projects/' },
};

/* ------------------------------ PKCE utils ------------------------------ */

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  const verifier = base64url(bytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

export async function beginOAuth(args: {
  service: string;
  client: string;
  env: Env;
  redirectUri: string;
  state: string;
  saveState: (state: string, verifier: string) => Promise<void>;
}): Promise<string> {
  const svc = OAUTH_SERVICES[args.service];
  if (!svc) throw new Error(`service "${args.service}" does not expose an OAuth flow in this gateway`);
  const clientId = args.env[svc.clientIdEnv];
  if (!clientId) {
    throw new Error(
      `Missing ${svc.clientIdEnv}. Create an OAuth app for this service on the vendor's developer portal, set ${svc.clientIdEnv}${svc.clientSecretEnv ? ` and ${svc.clientSecretEnv}` : ''} in the gateway environment, and retry.`,
    );
  }

  const url = new URL(svc.authorizeUrl);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', args.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', args.state);
  if (svc.scopes) url.searchParams.set('scope', svc.scopes);

  if (svc.pkce) {
    const { verifier, challenge } = await pkcePair();
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    await args.saveState(args.state, verifier);
  }
  return url.toString();
}

export async function finishOAuth(args: {
  service: string;
  env: Env;
  code: string;
  verifier?: string;
  redirectUri: string;
}): Promise<{ token: string; scopes?: string }> {
  const svc = OAUTH_SERVICES[args.service];
  if (!svc) throw new Error(`service "${args.service}" does not expose an OAuth flow in this gateway`);
  const clientId = args.env[svc.clientIdEnv];
  const clientSecret = svc.clientSecretEnv ? args.env[svc.clientSecretEnv] : undefined;

  const body = new URLSearchParams({
    client_id: clientId ?? '',
    code: args.code,
    grant_type: 'authorization_code',
    redirect_uri: args.redirectUri,
  });
  if (clientSecret) body.set('client_secret', clientSecret);
  if (args.verifier) body.set('code_verifier', args.verifier);

  const res = await fetch(svc.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* github returns form-encoded unless Accept: json is honoured */
  }
  const token = (json.access_token as string) ?? new URLSearchParams(text).get('access_token');
  if (!token) throw new Error((json.error_description as string) ?? (json.error as string) ?? 'no access token returned');
  return { token, scopes: typeof json.scope === 'string' ? json.scope : svc.scopes };
}

/* --------------------------- connection state --------------------------- */

export async function saveConnection(
  db: D1Database,
  secret: string,
  client: string,
  service: string,
  token: string,
  account?: string,
  scopes?: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO integrations (client, service, ciphertext, account, scopes, verified, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(client, service) DO UPDATE SET
         ciphertext = excluded.ciphertext, account = excluded.account,
         scopes = excluded.scopes, updated_at = excluded.updated_at`,
    )
    .bind(client, service, await encrypt(secret, token), account ?? '', scopes ?? '', Date.now())
    .run();
}

export async function readToken(db: D1Database, secret: string, client: string, service: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT ciphertext FROM integrations WHERE client = ? AND service = ?')
    .bind(client, service)
    .first<{ ciphertext: string }>();
  if (!row) return null;
  try {
    return await decrypt(secret, row.ciphertext);
  } catch {
    return null;
  }
}

/** Confirms a token against the vendor before we ever say "connected". */
export async function validateToken(
  service: string,
  token: string,
): Promise<{ ok: boolean; account?: string; message: string; scopes?: string[] }> {
  const spec = TOKEN_SERVICES[service];
  if (!spec) return { ok: false, message: `No validator is registered for "${service}".` };
  try {
    const res = await fetch(spec.validate, {
      method: spec.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(spec.headers ?? {}) },
    });
    if (!res.ok) return { ok: false, message: `Vendor replied ${res.status}` };
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const account =
      (json.login as string) ??
      (json.username as string) ??
      (json.email as string) ??
      (json.name as string) ??
      (json.id as string) ??
      undefined;
    return { ok: true, account, message: 'verified', scopes: [] };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/* ----------------------------- tool registry ---------------------------- */

export interface ToolContext {
  token: string;
  env: Env;
  args: Record<string, unknown>;
}

export interface ToolDef {
  id: string;
  service: string;
  sensitive?: boolean;
  run: (ctx: ToolContext) => Promise<unknown>;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

async function call(
  url: string,
  opts: { token: string; method?: string; body?: unknown; headers?: Record<string, string> },
): Promise<unknown> {
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${opts.token}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

const list = (items: unknown[]): unknown[] => items.slice(0, 30);

export const TOOLS: ToolDef[] = [
  /* ------------------------------ GitHub ------------------------------- */
  {
    id: 'list_repos',
    service: 'github',
    run: async ({ token }) => {
      const data = (await call('https://api.github.com/user/repos?per_page=30&sort=updated', { token })) as Array<
        Record<string, unknown>
      >;
      return list(
        data.map((r) => ({
          name: r.full_name,
          url: r.html_url,
          description: r.description,
          language: r.language,
          stars: r.stargazers_count,
          private: r.private,
        })),
      );
    },
  },
  {
    id: 'get_file',
    service: 'github',
    run: async ({ token, args }) => {
      const owner = str(args.owner);
      const repo = str(args.repo);
      const path = str(args.path);
      const ref = str(args.ref) || 'HEAD';
      return call(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`,
        { token },
      );
    },
  },
  {
    id: 'list_issues',
    service: 'github',
    run: async ({ token, args }) => {
      const owner = str(args.owner);
      const repo = str(args.repo);
      const data = (await call(`https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=20`, {
        token,
      })) as Array<Record<string, unknown>>;
      return list(
        data.map((i) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          url: i.html_url,
          author: (i.user as { login?: string } | undefined)?.login,
        })),
      );
    },
  },
  {
    id: 'create_issue',
    service: 'github',
    sensitive: true,
    run: async ({ token, args }) =>
      call(`https://api.github.com/repos/${str(args.owner)}/${str(args.repo)}/issues`, {
        token,
        method: 'POST',
        body: { title: str(args.title), body: str(args.body), labels: Array.isArray(args.labels) ? args.labels : [] },
      }),
  },
  {
    id: 'create_pr',
    service: 'github',
    sensitive: true,
    run: async ({ token, args }) =>
      call(`https://api.github.com/repos/${str(args.owner)}/${str(args.repo)}/pulls`, {
        token,
        method: 'POST',
        body: { title: str(args.title), head: str(args.head), base: str(args.base), body: str(args.body) },
      }),
  },

  /* ------------------------------ GitLab ------------------------------- */
  {
    id: 'list_projects',
    service: 'gitlab',
    run: async ({ token }) => {
      const data = (await call('https://gitlab.com/api/v4/projects?membership=true&per_page=20', { token })) as Array<
        Record<string, unknown>
      >;
      return list(data.map((p) => ({ name: p.name_with_namespace, url: p.web_url, id: p.id })));
    },
  },
  {
    id: 'list_issues',
    service: 'gitlab',
    run: async ({ token, args }) => {
      const project = encodeURIComponent(str(args.project));
      const data = (await call(`https://gitlab.com/api/v4/projects/${project}/issues?per_page=20`, { token })) as Array<
        Record<string, unknown>
      >;
      return list(data.map((i) => ({ title: i.title, state: i.state, url: i.web_url, iid: i.iid })));
    },
  },
  {
    id: 'pipeline_status',
    service: 'gitlab',
    run: async ({ token, args }) => {
      const project = encodeURIComponent(str(args.project));
      return call(`https://gitlab.com/api/v4/projects/${project}/pipelines?per_page=5`, { token });
    },
  },

  /* ------------------------------ Linear ------------------------------- */
  {
    id: 'list_issues',
    service: 'linear',
    run: async ({ token }) => {
      const res = await call('https://api.linear.app/graphql', {
        token,
        method: 'POST',
        body: {
          query:
            'query { issues(first: 20) { nodes { identifier title url priority state { name } } } }',
        },
      });
      return ((res as { data?: { issues?: { nodes?: unknown[] } } }).data?.issues?.nodes ?? []) as unknown[];
    },
  },
  {
    id: 'create_issue',
    service: 'linear',
    sensitive: true,
    run: async ({ token, args }) =>
      call('https://api.linear.app/graphql', {
        token,
        method: 'POST',
        body: {
          query: `mutation { issueCreate(input: { title: "${str(args.title).replace(/"/g, '\\"')}", description: "${str(args.body).replace(/"/g, '\\"')}" }) { success issue { identifier url } } }`,
        },
      }),
  },

  /* ------------------------------ Notion ------------------------------- */
  {
    id: 'search',
    service: 'notion',
    run: async ({ token, args }) =>
      call('https://api.notion.com/v1/search', {
        token,
        method: 'POST',
        body: { query: str(args.query), page_size: 20 },
        headers: { 'Notion-Version': '2022-06-28' },
      }),
  },
  {
    id: 'create_page',
    service: 'notion',
    sensitive: true,
    run: async ({ token, args }) =>
      call('https://api.notion.com/v1/pages', {
        token,
        method: 'POST',
        headers: { 'Notion-Version': '2022-06-28' },
        body: {
          parent: { database_id: str(args.database_id) },
          properties: { title: { title: [{ text: { content: str(args.title) } }] } },
        },
      }),
  },

  /* ------------------------------ Sentry ------------------------------- */
  {
    id: 'list_projects',
    service: 'sentry',
    run: async ({ token }) => list((await call('https://sentry.io/api/0/projects/', { token })) as unknown[]),
  },
  {
    id: 'list_issues',
    service: 'sentry',
    run: async ({ token }) =>
      list((await call('https://sentry.io/api/0/issues/?statsPeriod=24h&limit=20', { token })) as unknown[]),
  },

  /* ------------------------------- Slack ------------------------------- */
  {
    id: 'search_messages',
    service: 'slack',
    run: async ({ token, args }) =>
      call(`https://slack.com/api/search.messages?query=${encodeURIComponent(str(args.query))}&count=20`, { token }),
  },
  {
    id: 'post_message',
    service: 'slack',
    sensitive: true,
    run: async ({ token, args }) =>
      call('https://slack.com/api/chat.postMessage', {
        token,
        method: 'POST',
        body: { channel: str(args.channel), text: str(args.text) },
      }),
  },

  /* ------------------------------ Vercel ------------------------------- */
  {
    id: 'list_projects',
    service: 'vercel',
    run: async ({ token }) =>
      call('https://api.vercel.com/v9/projects?limit=20', { token }) as Promise<unknown>,
  },
  {
    id: 'list_deployments',
    service: 'vercel',
    run: async ({ token }) =>
      call('https://api.vercel.com/v6/deployments?limit=20', { token }) as Promise<unknown>,
  },

  /* --------------------------- Google Drive ----------------------------- */
  {
    id: 'search_files',
    service: 'gdrive',
    run: async ({ token, args }) =>
      call(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name contains '${str(args.query)}'`)}&pageSize=20&fields=files(id,name,mimeType,webViewLink)`,
        { token },
      ),
  },

  /* ------------------------------- Figma ------------------------------- */
  {
    id: 'list_files',
    service: 'figma',
    run: async ({ token, args }) =>
      call(`https://api.figma.com/v1/files/${str(args.file_key)}`, {
        token,
        headers: { 'X-Figma-Token': token },
      }),
  },
];

export function toolsFor(service: string): ToolDef[] {
  return TOOLS.filter((t) => t.service === service);
}

export async function runTool(service: string, toolId: string, token: string, env: Env, args: Record<string, unknown>): Promise<unknown> {
  const tool = TOOLS.find((t) => t.service === service && t.id === toolId);
  if (!tool) {
    const available = toolsFor(service).map((t) => t.id);
    throw new Error(
      available.length
        ? `Tool "${toolId}" is not registered for ${service}. Available: ${available.join(', ')}`
        : `No tools are registered for ${service} in this gateway build.`,
    );
  }
  return tool.run({ token, env, args });
}
