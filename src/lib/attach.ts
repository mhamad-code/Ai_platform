/** Classify and extract text from attachments so the model can actually read them. */

export type AttachKind = 'image' | 'pdf' | 'doc' | 'sheet' | 'text' | 'code' | 'other';

const CODE_EXT = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cc', 'cpp', 'h',
  'cs', 'php', 'sh', 'bash', 'zsh', 'sql', 'html', 'css', 'scss', 'json', 'yaml', 'yml', 'toml', 'xml', 'vue', 'svelte',
  'dart', 'scala', 'ex', 'exs', 'lua', 'r', 'pl', 'ps1', 'dockerfile', 'gradle', 'tf',
]);
const TEXT_EXT = new Set(['txt', 'md', 'markdown', 'log', 'csv', 'tsv', 'rtf']);
const DOC_EXT = new Set(['doc', 'docx', 'odt', 'pages']);
const SHEET_EXT = new Set(['xls', 'xlsx', 'ods', 'numbers']);

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_TEXT_CHARS = 60_000;

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function classify(name: string, mime = ''): AttachKind {
  const ext = extOf(name);
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'svg'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (DOC_EXT.has(ext) || mime.includes('word')) return 'doc';
  if (SHEET_EXT.has(ext) || mime.includes('sheet') || mime.includes('excel')) return 'sheet';
  if (CODE_EXT.has(ext)) return 'code';
  if (TEXT_EXT.has(ext) || mime.startsWith('text/')) return 'text';
  return 'other';
}

export function isTextLike(kind: AttachKind): boolean {
  return kind === 'text' || kind === 'code';
}

export function supportsPreview(kind: AttachKind): boolean {
  return kind === 'image' || kind === 'text' || kind === 'code' || kind === 'pdf' || kind === 'sheet';
}

export interface Extracted {
  text?: string;
  dataUrl?: string;
  note?: string;
}

export async function extract(file: File, kind: AttachKind): Promise<Extracted> {
  if (kind === 'image') {
    if (file.size > MAX_IMAGE_BYTES) return { note: 'image-too-large' };
    const dataUrl = await readAsDataURL(file);
    return { dataUrl };
  }
  if (isTextLike(kind)) {
    const raw = await file.text();
    return { text: raw.slice(0, MAX_TEXT_CHARS) };
  }
  if (kind === 'pdf') return extractPdf(file);
  if (kind === 'doc') return extractDocx(file);
  if (kind === 'sheet') return extractXlsx(file);
  return { note: 'unsupported-extraction' };
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function extractPdf(file: File): Promise<Extracted> {
  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const pages: string[] = [];
    const limit = Math.min(doc.numPages, 40);
    for (let i = 1; i <= limit; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const line = content.items
        .map((it) => ('str' in it ? it.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (line) pages.push(`[p.${i}] ${line}`);
    }
    await doc.destroy();
    return { text: pages.join('\n').slice(0, MAX_TEXT_CHARS) };
  } catch (e) {
    return { note: `pdf-failed:${(e as Error).message}` };
  }
}

async function extractDocx(file: File): Promise<Extracted> {
  try {
    const { unzipSync, strFromU8 } = await import('fflate');
    const u8 = new Uint8Array(await file.arrayBuffer());
    const files = unzipSync(u8);
    const entry = files['word/document.xml'];
    if (!entry) return { note: 'not-a-docx' };
    const xml = strFromU8(entry);
    const text = xml
      .replace(/<w:p[ >]/g, '\n<w:p ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return { text: text.slice(0, MAX_TEXT_CHARS) };
  } catch (e) {
    return { note: `docx-failed:${(e as Error).message}` };
  }
}

async function extractXlsx(file: File): Promise<Extracted> {
  try {
    const { unzipSync, strFromU8 } = await import('fflate');
    const u8 = new Uint8Array(await file.arrayBuffer());
    const files = unzipSync(u8);
    const sharedXml = files['xl/sharedStrings.xml'];
    const shared: string[] = [];
    if (sharedXml) {
      const xml = strFromU8(sharedXml);
      for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
        shared.push(m[1].replace(/<[^>]+>/g, ''));
      }
    }
    const sheetName = Object.keys(files).find((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
    if (!sheetName) return { note: 'not-an-xlsx' };
    const xml = strFromU8(files[sheetName]);
    const rows: string[] = [];
    for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const cm of rm[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = cm[1];
        const inner = cm[2];
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(inner);
        let value = vMatch ? vMatch[1] : '';
        if (/t="s"/.test(attrs)) value = shared[Number(value)] ?? value;
        else if (/t="inlineStr"/.test(inner)) value = inner.replace(/<[^>]+>/g, '');
        cells.push(value);
      }
      if (cells.length) rows.push(cells.join(' | '));
      if (rows.length > 400) break;
    }
    return { text: rows.join('\n').slice(0, MAX_TEXT_CHARS) };
  } catch (e) {
    return { note: `xlsx-failed:${(e as Error).message}` };
  }
}
