import { storage } from 'wxt/utils/storage';
import { matchField, type FormControl } from './matcher';

/** An answer the user typed into a field the profile doesn't cover, remembered for next time. */
export interface LearnedAnswer {
  id: string;
  /** The question as shown on the page, e.g. "Are you legally authorized to work in the US?" */
  question: string;
  /** Normalized question, used for matching. */
  norm: string;
  /** Text typed, or the chosen option's visible text for dropdowns and radio buttons. */
  value: string;
  /** The chosen option's `value` attribute, a second way to find the option again. */
  optionValue?: string;
  kind: 'text' | 'select' | 'radio';
  /** Site it was learned on, shown on the options page. */
  host: string;
  updatedAt: number;
}

export interface Settings {
  /** Remember answers to questions the profile doesn't cover. */
  learn: boolean;
}

export const answersItem = storage.defineItem<LearnedAnswer[]>('local:answers', { fallback: [] });
export const settingsItem = storage.defineItem<Settings>('local:settings', { fallback: { learn: true } });

export async function getAnswers(): Promise<LearnedAnswer[]> {
  return (await answersItem.getValue()) ?? [];
}

export async function getSettings(): Promise<Settings> {
  return { learn: (await settingsItem.getValue())?.learn ?? true };
}

const MAX_QUESTION_LEN = 200;
const MAX_ANSWER_LEN = 5000;

/** Never remember these: secrets, payment details, government IDs, one-time codes. */
const SENSITIVE =
  /password|passcode|passwd|\bpin\b|card ?(number|no)|credit card|debit card|cvv|cvc|security code|expir|routing|account number|iban|swift|\bssn\b|social security|national id|passport|tax id|\btin\b|one[- ]time|verification code|otp|captcha|密码|验证码|身份证|银行卡|卡号|护照/i;

/** Labels too vague to mean the same thing on another form. */
const GENERIC = new Set([
  'other', 'others', 'please specify', 'if other please specify', 'specify', 'comment', 'comments',
  'answer', 'your answer', 'select', 'select one', 'choose', 'choose one', 'please select', 'yes', 'no',
  'search', 'message', 'notes', 'details', 'description', 'value', 'type here', 'enter text', '其他', '请选择', '备注',
]);

const SKIP_AUTOCOMPLETE = /^(cc-|one-time-code|current-password|new-password|username)/;

function visibleText(el: Element | null | undefined): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function fits(text: string): string {
  return text.length > 0 && text.length <= MAX_QUESTION_LEN ? text : '';
}

/**
 * The question a field asks, as the user sees it. Unlike the profile matcher this keeps
 * long, sentence-style questions common on job applications, and ignores `name`/`id`,
 * which are often machine-generated (e.g. `question_48213`).
 */
export function questionText(el: FormControl): string {
  if (el instanceof HTMLInputElement && el.type === 'radio') {
    const legend = visibleText(el.closest('fieldset')?.querySelector('legend'));
    return fits(legend) || fits(radioCaption(el)) || fits(el.getAttribute('aria-label') ?? '');
  }
  const candidates = [
    ...[...(el.labels ?? [])].map((l) => labelOwnText(l, el)),
    ...(el.getAttribute('aria-labelledby') ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => visibleText(el.ownerDocument.getElementById(id))),
    el.getAttribute('aria-label') ?? '',
    visibleText(el.previousElementSibling),
    visibleText(el.parentElement?.previousElementSibling),
    el.getAttribute('placeholder') ?? '',
    el.getAttribute('title') ?? '',
  ];
  for (const c of candidates) {
    const text = fits(c.replace(/\s+/g, ' ').trim());
    if (text && normalizeQuestion(text)) return text;
  }
  return '';
}

/** Text around a radio group, e.g. "Will you require sponsorship?" in `<div>…<label><input type=radio>Yes</label></div>`. */
function radioCaption(el: HTMLInputElement): string {
  let node: Element | null = el.parentElement;
  for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
    if (node.tagName === 'LABEL') continue;
    const own = [...node.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const text = fits(own) || fits(visibleText(node.previousElementSibling));
    if (text) return text;
  }
  return '';
}

/** A wrapping <label> also contains the control (and a select's option text); keep only the caption. */
function labelOwnText(label: HTMLLabelElement, el: FormControl): string {
  if (!label.contains(el)) return visibleText(label);
  const clone = label.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('input, select, textarea, option').forEach((n) => n.remove());
  return visibleText(clone);
}

export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/\((optional|required)\)|optional$|required$|必填|选填/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function tokens(norm: string): Set<string> {
  const out = new Set<string>();
  for (const word of norm.split(' ')) {
    if (/[一-龥]/.test(word)) {
      // Chinese has no spaces: compare character pairs instead of words.
      for (let i = 0; i < word.length - 1; i++) out.add(word.slice(i, i + 2));
      if (word.length === 1) out.add(word);
    } else if (word) {
      out.add(word);
    }
  }
  return out;
}

/** Dice coefficient over word (or Chinese character-pair) sets: 1 = same words, 0 = nothing shared. */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return (2 * shared) / (ta.size + tb.size);
}

const SIMILAR_THRESHOLD = 0.8;
const MIN_TOKENS_FOR_FUZZY = 4;

/**
 * The learned answer for a question: an exact match, or failing that a near-identical
 * wording ("Are you authorized to work in the US?" vs "Are you legally authorized to work in the US?").
 * Short questions only match exactly, since one changed word can change their meaning.
 */
export function findAnswer(
  answers: LearnedAnswer[],
  norm: string,
  mode: 'exact' | 'similar',
): LearnedAnswer | undefined {
  if (!norm) return undefined;
  const exact = answers.find((a) => a.norm === norm);
  if (exact || mode === 'exact') return exact;
  if (tokens(norm).size < MIN_TOKENS_FOR_FUZZY) return undefined;
  let best: LearnedAnswer | undefined;
  let bestScore = SIMILAR_THRESHOLD;
  for (const a of answers) {
    const score = similarity(norm, a.norm);
    if (score >= bestScore) {
      best = a;
      bestScore = score;
    }
  }
  return best;
}

function isSearchField(el: FormControl): boolean {
  if (el instanceof HTMLInputElement && el.type === 'search') return true;
  if (el.closest('[role=search]')) return true;
  return /^(q|query|search|keyword)s?$/i.test(el.getAttribute('name') ?? '');
}

/** Sentence-style questions trip keyword rules ("Have you worked for this company before?" isn't the company name). */
function isSentence(norm: string): boolean {
  return norm.split(' ').length >= 4;
}

/**
 * What to remember after the user answered a field, or null when it shouldn't be learned:
 * sensitive, empty, a search box, a vague label, or something the profile already covers.
 */
export function captureAnswer(el: FormControl, host: string): LearnedAnswer | null {
  if (el.disabled) return null;
  if (el instanceof HTMLInputElement && !['text', 'email', 'tel', 'url', 'number', 'date', 'radio', ''].includes(el.type)) {
    return null;
  }
  if (SKIP_AUTOCOMPLETE.test((el.getAttribute('autocomplete') ?? '').trim().split(/\s+/).pop() ?? '')) return null;
  if (isSearchField(el)) return null;

  const question = questionText(el);
  const norm = normalizeQuestion(question);
  if (!norm || norm.length < 2 || GENERIC.has(norm)) return null;
  if (SENSITIVE.test(question) || SENSITIVE.test(el.getAttribute('name') ?? '') || SENSITIVE.test(el.id)) return null;
  if (matchField(el) && !isSentence(norm)) return null;

  const base = { id: '', question, norm, host, updatedAt: Date.now() };
  if (el instanceof HTMLSelectElement) {
    const opt = el.selectedOptions[0];
    if (!opt || (el.selectedIndex <= 0 && !opt.value)) return null;
    return { ...base, kind: 'select', value: opt.text.trim(), optionValue: opt.value };
  }
  if (el instanceof HTMLInputElement && el.type === 'radio') {
    if (!el.checked) return null;
    const text = [...(el.labels ?? [])].map((l) => visibleText(l)).find(Boolean) ?? el.value;
    return { ...base, kind: 'radio', value: text, optionValue: el.value };
  }
  const value = el.value.trim();
  if (!value || value.length > MAX_ANSWER_LEN) return null;
  return { ...base, kind: 'text', value };
}

/** Insert or replace by question; newest answer wins. */
export function upsertAnswer(list: LearnedAnswer[], answer: LearnedAnswer): LearnedAnswer[] {
  const existing = list.find((a) => a.norm === answer.norm);
  const id = existing?.id || answer.id || crypto.randomUUID();
  return [{ ...answer, id }, ...list.filter((a) => a.norm !== answer.norm)];
}

let queue: Promise<unknown> = Promise.resolve();

/** Serialize writes so quick successive answers don't overwrite each other. */
export function saveAnswers(batch: LearnedAnswer[]): Promise<void> {
  if (!batch.length) return Promise.resolve();
  const next = queue.then(async () => answersItem.setValue(batch.reduce(upsertAnswer, await getAnswers())));
  queue = next.catch(() => {});
  return next;
}

function isControl(el: EventTarget | null): el is FormControl {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

/**
 * Remember what the user types on this page, until it is closed. Only fields the user
 * actually edited (trusted `input`/`change` events) count, so the extension's own fills,
 * the site's prefilled values and the page's scripts are never learned.
 *
 * Answers are saved when a field is committed (`change`), and again for every edited
 * field when the form is submitted or the page is left, which catches a field the user
 * typed into and then submitted with Enter or navigated away from.
 */
export function watchAnswers(root: Document = document): void {
  const touched = new Set<FormControl>();
  const capture = (els: Iterable<FormControl>) => {
    const batch: LearnedAnswer[] = [];
    for (const el of els) {
      const answer = el.isConnected ? captureAnswer(el, location.hostname) : null;
      if (answer) batch.push(answer);
    }
    saveAnswers(batch).catch(console.error);
  };

  const onEdit = (e: Event) => {
    if (!e.isTrusted || !isControl(e.target)) return;
    touched.add(e.target);
    if (e.type === 'change') capture([e.target]);
  };
  root.addEventListener('input', onEdit, true);
  root.addEventListener('change', onEdit, true);

  const flush = () => {
    if (!touched.size) return;
    capture(touched);
    touched.clear();
  };
  root.addEventListener('submit', flush, true);
  root.defaultView?.addEventListener('pagehide', flush, true);
  root.addEventListener('visibilitychange', () => root.visibilityState === 'hidden' && flush(), true);
}
