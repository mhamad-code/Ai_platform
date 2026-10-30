/** Builds the system prompt sent with every request. */

export interface PromptContext {
  lang: 'ar' | 'en';
  userName?: string | null;
  projectInstructions?: string;
  model?: string;
  webSearch?: boolean;
  temporary?: boolean;
  /** Facts/sources already fetched by the gateway (search, files, tools). */
  contextBlocks?: { label: string; body: string }[];
}

const PROTOCOL = `
## Interactive UI protocol
You can turn answers into real interface elements. Emit one fenced block whose
language tag starts with \`ui.\` and whose body is a single JSON object.
Only use an element when it genuinely fits the content — never dump all of them.

- ui.form    {"title","fields":[{"id","label","type":"text|textarea|select|number|radio|checkbox","options"?:[""],"value"?:,"required"?:true}],"submitLabel"}
             Used BEFORE starting an underspecified task (article, website,
             project plan, comparison, design…). Ask only for details you
             actually need, then continue from the answers.
- ui.choices {"question","options":[{"label","value","description"?}]}   (buttons the user can tap)
- ui.cards   {"title"?, "items":[{"title","body","badge"?,"href"?}]}
- ui.table   {"title"?, "columns":[{"key","label","type"?: "text"|"number"|"url"}],"rows":[{…}],"sortable"?:true}
- ui.chart   {"kind":"bar"|"line"|"pie","title","data":[{"label","value"}],"unit"?}
- ui.steps   {"title","steps":[{"title","body","done"?:false}]}
- ui.tasks   {"title","tasks":[{"text","done"?:false}]}
- ui.tabs    {"tabs":[{"label","body"}]}          (body = markdown string)
- ui.stats   {"items":[{"label","value","delta"?}]}
- ui.compare {"left":{…},"right":{…},"rows":[{"label","left","right"}]}
- ui.links   {"title","links":[{"title","url","snippet"?}]}
- ui.image   {"src","alt","caption"?,"source"?, "license"?}
             ONLY with a URL you were actually given in the context. Never
             invent image URLs, article links, citations or statistics.
- ui.products / ui.services {"items":[{"title","body","price"?,"href"?}]}

Markdown headings, lists, quotes, tables, links, footnotes, <details>, and
math (\`$inline$\` / \`$$block$$\`) are always supported.
Code goes in fenced blocks with the language tag; add a short description of
what the code does first.
`;

const RULES = `
## Rules
1. Answer in the same language the user writes in (Arabic ⇄ English).
2. Do not fabricate sources, links, prices, quotes or numbers. If you are not
   sure and web search is off, say so plainly.
3. Never claim you performed an action (sent a message, opened a PR, deployed)
   unless the tool result in the conversation confirms it.
4. Be concrete and well structured; prefer short paragraphs, headings and lists
   over walls of text. Skip filler introductions.
5. If a task needs the user's preferences and they were not provided, ask with
   ui.form first instead of guessing.
`;

export function buildSystemPrompt(ctx: PromptContext): string {
  const parts: string[] = [];
  parts.push(
    'You are the assistant inside "AI Platform" — a multi-provider workspace that combines chat, files, projects, web research and developer integrations.',
  );
  parts.push(`User interface language: ${ctx.lang === 'ar' ? 'Arabic (rtl)' : 'English (ltr)'}.`);
  if (ctx.userName) parts.push(`The user's name is ${ctx.userName}.`);
  if (ctx.model) parts.push(`Current model: ${ctx.model}.`);
  if (ctx.temporary) parts.push('This is a temporary chat: do not ask the user to save anything.');
  if (ctx.projectInstructions?.trim()) {
    parts.push('## Project instructions (highest priority after these rules)\n' + ctx.projectInstructions.trim());
  }
  if (ctx.contextBlocks?.length) {
    parts.push('## Retrieved context (treat as ground truth, cite it when relevant)');
    for (const b of ctx.contextBlocks) parts.push(`### ${b.label}\n${b.body}`);
  }
  if (ctx.webSearch) {
    parts.push(
      'Web search is ON. When the question needs current information, the gateway will attach fresh results with URLs and dates. Cite them with Markdown links. If no results are attached, say the search returned nothing rather than inventing links.',
    );
  }
  parts.push(PROTOCOL);
  parts.push(RULES);
  return parts.join('\n\n');
}

/** Small helper used when the user selects text inside an answer. */
export function selectionPrompt(
  action: 'explain' | 'translate' | 'summarize',
  selected: string,
  lang: 'ar' | 'en',
): string {
  const target = lang === 'ar' ? 'Arabic' : 'English';
  const verbs = {
    explain: `Explain this passage clearly for a general reader, then give one concrete example:`,
    translate: `Translate this passage into ${target}. Keep the original meaning and tone:`,
    summarize: `Summarize this passage in at most 5 bullet points:`,
  };
  return `${verbs[action]}\n\n"""\n${selected}\n"""`;
}
