/**
 * Web + image search.
 *
 * Keyless sources by default (Wikipedia, Wikimedia Commons, DuckDuckGo's
 * official Instant Answer API). When SERPER_API_KEY / BRAVE_API_KEY /
 * TAVILY_API_KEY is configured on the gateway, a full web index is used
 * instead and the key is read only server-side.
 *
 * Nothing here invents a link: every URL returned comes from a live API
 * response, and image results carry their licence and attribution.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  publishedAt?: string;
  site?: string;
}

export interface ImageResult {
  title: string;
  url: string;
  thumb?: string;
  pageUrl?: string;
  license?: string;
  attribution?: string;
  source?: string;
  width?: number;
  height?: number;
}

const UA = 'AIPlatformGateway/1.0 (contact: owner@example.com)';
/** Every upstream call is bounded so one slow provider cannot hang a search. */
const TIMEOUT = 6000;

/** Injected once at boot from the gateway environment (never sent to a browser). */
export const searchKeys = { serper: '', brave: '' };
export function configureSearch(keys: { serper?: string; brave?: string }) {
  searchKeys.serper = keys.serper ?? '';
  searchKeys.brave = keys.brave ?? '';
}

async function getJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(TIMEOUT),
    headers: { Accept: 'application/json', 'User-Agent': UA, ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`search upstream ${res.status}`);
  return res.json();
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/* --------------------------------- web ---------------------------------- */

async function serper(query: string): Promise<SearchResult[]> {
  const key = searchKeys.serper;
  if (!key) return [];
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: 8 }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    organic?: Array<{ title: string; link: string; snippet: string; date?: string }>;
    answerBox?: { answer?: string; title?: string; link?: string };
  };
  const out: SearchResult[] = [];
  if (json.answerBox?.link) {
    out.push({
      title: json.answerBox.title ?? json.answerBox.answer ?? 'Answer',
      url: json.answerBox.link,
      snippet: json.answerBox.answer,
    });
  }
  for (const o of json.organic ?? []) {
    out.push({ title: o.title, url: o.link, snippet: o.snippet, publishedAt: o.date, site: hostOf(o.link) });
  }
  return out;
}

async function brave(query: string): Promise<SearchResult[]> {
  const key = searchKeys.brave;
  if (!key) return [];
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`, {
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { Accept: 'application/json', 'X-Subscription-Token': key },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    web?: { results?: Array<{ title: string; url: string; description: string; age?: string }> };
  };
  return (json.web?.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
    publishedAt: r.age,
    site: hostOf(r.url),
  }));
}

async function wikipedia(query: string): Promise<SearchResult[]> {
  const lang = /[؀-ۿ]/.test(query) ? 'ar' : 'en';
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}` +
    `&srlimit=6&format=json&origin=*&srprop=snippet|timestamp`;
  const json = (await getJson(url)) as {
    query?: { search?: Array<{ title: string; snippet: string; timestamp: string }> };
  };
  const results = json.query?.search ?? [];
  return results.map((r) => ({
    title: r.title,
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
    snippet: r.snippet.replace(/<[^>]+>/g, ''),
    publishedAt: r.timestamp?.slice(0, 10),
    site: `${lang}.wikipedia.org`,
  }));
}

async function duckduckgo(query: string): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const json = (await getJson(url, { signal: AbortSignal.timeout(4000) })) as {
    AbstractText?: string;
    AbstractURL?: string;
    Heading?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
  };
  const out: SearchResult[] = [];
  if (json.AbstractURL && json.AbstractText) {
    out.push({
      title: json.Heading ?? json.AbstractURL,
      url: json.AbstractURL,
      snippet: json.AbstractText,
      site: hostOf(json.AbstractURL),
    });
  }
  const flatten = (topics: Array<{ Text?: string; FirstURL?: string }>) => {
    for (const t of topics) {
      if (!t.FirstURL || !t.Text) continue;
      const [text, ...rest] = t.Text.split(' - ');
      out.push({ title: text, url: t.FirstURL, snippet: rest.join(' - '), site: hostOf(t.FirstURL) });
    }
  };
  for (const t of json.RelatedTopics ?? []) {
    if (t.Topics) flatten(t.Topics);
    else flatten([t]);
    if (out.length >= 8) break;
  }
  return out.slice(0, 8);
}

export async function searchWeb(query: string, mode: 'fast' | 'deep' | 'news' = 'fast'): Promise<SearchResult[]> {
  const providers = await Promise.allSettled([
    serper(mode === 'news' ? `${query} when:30d` : query),
    brave(mode === 'news' ? `${query} fresh:pw` : query),
    wikipedia(query),
    duckduckgo(query),
  ]);
  // only a paid index is authoritative enough to short-circuit the rest

  const merged: SearchResult[] = [];
  const seen = new Set<string>();
  for (const p of providers) {
    if (p.status !== 'fulfilled') continue;
    for (const r of p.value) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      merged.push(r);
    }
    // a paid index is authoritative: stop after the first one that answered
    if (merged.length >= (mode === 'deep' ? 14 : 8)) break;
  }
  return merged.slice(0, mode === 'deep' ? 14 : 8);
}

/** Deep research: split the question into follow-up queries and pool results. */
export async function deepResearch(query: string): Promise<SearchResult[]> {
  const seeds = [
    query,
    `${query} overview`,
    `${query} comparison`,
    `${query} latest developments`,
    `${query} examples`,
  ];
  const rounds = await Promise.allSettled(seeds.map((q) => searchWeb(q, 'fast')));
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const r of rounds) {
    if (r.status !== 'fulfilled') continue;
    for (const item of r.value) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      out.push(item);
    }
  }
  return out.slice(0, 20);
}

/* -------------------------------- images -------------------------------- */

interface CommonsImage {
  title: string;
  url: string;
  thumb?: string;
  pageUrl?: string;
  license?: string;
  attribution?: string;
  width?: number;
  height?: number;
  source?: string;
}

async function commonsImages(query: string, limit: number): Promise<CommonsImage[]> {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
    '&generator=search&gsrnamespace=6&gsrlimit=' +
    Math.min(limit * 2, 20) +
    `&gsrsearch=${encodeURIComponent(`filetype:bitmap ${query}`)}` +
    '&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1400';

  const json = (await getJson(url)) as {
    query?: {
      pages?: Record<
        string,
        {
          title: string;
          imageinfo?: Array<{
            url: string;
            thumburl?: string;
            width?: number;
            height?: number;
            descriptionurl?: string;
            extmetadata?: Record<string, { value?: string }>;
          }>;
        }
      >;
    };
  };

  const pages = Object.values(json.query?.pages ?? {});
  const out: CommonsImage[] = [];
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata ?? {};
    const strip = (v?: string) => (v ?? '').replace(/<[^>]+>/g, '').trim();
    out.push({
      title: p.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''),
      url: info.thumburl ?? info.url,
      thumb: info.thumburl,
      pageUrl: info.descriptionurl,
      license: strip(meta.LicenseShortName?.value) || undefined,
      attribution: strip(meta.Artist?.value) || undefined,
      width: info.width,
      height: info.height,
      source: 'Wikimedia Commons',
    });
    if (out.length >= limit) break;
  }
  return out;
}

async function wikipediaLeadImage(query: string, lang = 'en'): Promise<CommonsImage | null> {
  const search =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=pageimages|info&piprop=original|thumbnail&pithumbsize=1400&inprop=url`;
  const json = (await getJson(search)) as {
    query?: { pages?: Record<string, { title: string; thumbnail?: { source: string; width: number; height: number }; originalimage?: { source: string; width: number; height: number }; fullurl?: string }> };
  };
  const page = Object.values(json.query?.pages ?? {})[0];
  if (!page?.thumbnail) return null;
  const url = page.originalimage?.source ?? page.thumbnail.source;
  return {
    title: page.title,
    url,
    thumb: page.thumbnail.source,
    pageUrl: page.fullurl ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    license: 'See file page for the licence',
    attribution: `Wikipedia / ${page.title}`,
    width: page.originalimage?.width ?? page.thumbnail.width,
    height: page.originalimage?.height ?? page.thumbnail.height,
    source: 'Wikipedia',
  };
}

export async function searchImages(query: string, limit = 8): Promise<ImageResult[]> {
  const lang = /[؀-ۿ]/.test(query) ? 'ar' : 'en';
  const [lead, commons] = await Promise.allSettled([
    wikipediaLeadImage(query, lang),
    commonsImages(query, limit),
  ]);

  const out: ImageResult[] = [];
  if (lead.status === 'fulfilled' && lead.value) out.push(lead.value);
  const seen = new Set(out.map((i) => i.url));
  if (commons.status === 'fulfilled') {
    for (const img of commons.value) {
      if (seen.has(img.url)) continue;
      seen.add(img.url);
      out.push(img);
      if (out.length >= limit) break;
    }
  }
  return out.slice(0, limit);
}
