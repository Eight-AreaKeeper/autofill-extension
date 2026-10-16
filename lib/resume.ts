import { storage } from 'wxt/utils/storage';
import { descriptors } from './matcher';

export interface StoredResume {
  name: string;
  type: string;
  size: number;
  /** File contents, base64-encoded. */
  data: string;
  updatedAt: number;
}

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export const resumeItem = storage.defineItem<StoredResume | null>('local:resume', { fallback: null });

export async function getResume(): Promise<StoredResume | null> {
  return (await resumeItem.getValue()) ?? null;
}

export async function fileToResume(file: File): Promise<StoredResume> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { name: file.name, type: file.type, size: file.size, data: btoa(binary), updatedAt: Date.now() };
}

export function resumeToFile(r: StoredResume): File {
  const binary = atob(r.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], r.name, { type: r.type, lastModified: r.updatedAt });
}

const RESUME = /resume|résumé|(^|[^a-z])cv([^a-z]|$)|curriculum vitae|简历|履历/i;
const NOT_RESUME =
  /cover[\s_-]?letter|transcript|photo|picture|avatar|headshot|portfolio|certificate|diploma|id card|passport|signature|logo|求职信|照片|头像|证书|成绩单/i;

/** Text of the nearest few ancestors, for upload widgets that hide the real input behind a styled box. */
function surroundingText(el: Element): string[] {
  const out: string[] = [];
  let node = el.parentElement;
  for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text.length > 200) break;
    if (text) out.push(text);
  }
  return out;
}

/** Whether the input's `accept` list allows this file (an empty list allows anything). */
export function accepts(input: HTMLInputElement, name: string, type: string): boolean {
  const accept = input.accept.trim();
  if (!accept) return true;
  const ext = name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  return accept
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .some((a) => a === ext || a === type || (a.endsWith('/*') && type.startsWith(a.slice(0, -1))));
}

/**
 * Whether a file input is asking for a resume/CV. Hidden inputs count: application sites
 * routinely hide the real `<input type=file>` behind a drop zone or "Attach" button.
 */
export function isResumeInput(input: HTMLInputElement): boolean {
  const own = [...descriptors(input), input.getAttribute('data-automation-id') ?? '', input.accept];
  if (own.some((t) => NOT_RESUME.test(t))) return false;
  if (own.some((t) => RESUME.test(t))) return true;
  const nearby = surroundingText(input);
  const firstHit = nearby.find((t) => RESUME.test(t) || NOT_RESUME.test(t));
  if (firstHit) return RESUME.test(firstHit) && !NOT_RESUME.test(firstHit);

  // Last resort: the page's only upload, on a page that mentions a resume.
  const doc = input.ownerDocument;
  return doc.querySelectorAll('input[type=file]').length === 1 && RESUME.test(doc.body?.textContent ?? '');
}

/** Attach the resume to every empty resume upload on the page. Returns how many were attached. */
export function attachResume(resume: StoredResume, root: Document = document): number {
  let attached = 0;
  for (const input of root.querySelectorAll<HTMLInputElement>('input[type=file]')) {
    if (input.disabled || input.files?.length) continue;
    if (!isResumeInput(input) || !accepts(input, resume.name, resume.type)) continue;
    const dt = new DataTransfer();
    dt.items.add(resumeToFile(resume));
    input.files = dt.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    attached++;
  }
  return attached;
}
