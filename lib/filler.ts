import { matchField, valueVariants, findLabelText, type FormControl } from './matcher';
import { withDerived, type Profile, type ProfileKey } from './profile';
import { findAnswer, normalizeQuestion, questionText, type LearnedAnswer } from './learning';
import { attachResume, type StoredResume } from './resume';

export interface FillResult {
  filled: number;
  fields: ProfileKey[];
  /** How many of `filled` came from answers learned on earlier forms. */
  fromLearned: number;
  /** How many file inputs got the resume. */
  resumes: number;
}

export interface FillExtras {
  answers?: LearnedAnswer[];
  resume?: StoredResume | null;
}

const SKIP_INPUT_TYPES = new Set([
  'hidden', 'password', 'submit', 'button', 'reset', 'image', 'file', 'checkbox', 'range', 'color',
]);

function isFillable(el: FormControl): boolean {
  if (el.disabled) return false;
  if (!(el instanceof HTMLSelectElement) && el.readOnly) return false;
  if (el instanceof HTMLInputElement && SKIP_INPUT_TYPES.has(el.type)) return false;
  // Invisible fields are often honeypots; leave them alone.
  return el.getClientRects().length > 0;
}

/** Assign through the native setter so React/Vue controlled inputs notice the change. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Long enough to substring-match option text without false hits (e.g. "us" inside "Russia"). */
function isDistinctive(v: string): boolean {
  return v.length > 3 || (v.length > 1 && /[一-龥]/.test(v));
}

function fillSelect(el: HTMLSelectElement, variants: string[]): boolean {
  const options = [...el.options].filter((o) => !o.disabled);
  const norm = (s: string) => s.trim().toLowerCase();
  const option =
    options.find((o) => variants.includes(norm(o.text)) || variants.includes(norm(o.value))) ??
    options.find((o) => o.value && variants.some((v) => isDistinctive(v) && norm(o.text).includes(v)));
  if (!option) return false;
  el.value = option.value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function fillRadio(el: HTMLInputElement, variants: string[]): boolean {
  const group = el.name
    ? [...el.ownerDocument.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${CSS.escape(el.name)}"]`)]
    : [el];
  if (group.some((r) => r.checked)) return false;
  const target = group.find((r) =>
    [r.value, ...findLabelText(r)].some((t) => variants.includes(t.trim().toLowerCase())),
  );
  if (!target) return false;
  target.click();
  return true;
}

function highlight(el: HTMLElement) {
  const prev = el.style.outline;
  el.style.outline = '2px solid #4f8cff';
  setTimeout(() => (el.style.outline = prev), 1500);
}

function learnedVariants(a: LearnedAnswer): string[] {
  return [...new Set([a.value, a.optionValue ?? ''].map((v) => v.trim().toLowerCase()).filter(Boolean))];
}

/**
 * Fill every empty field we can. For each field, in order: an answer the user gave to this exact
 * question before, then the profile, then a learned answer to a near-identical question.
 */
export function fillPage(profile: Profile, root: Document = document, extras: FillExtras = {}): FillResult {
  const data = withDerived(profile);
  const answers = extras.answers ?? [];
  const result: FillResult = { filled: 0, fields: [], fromLearned: 0, resumes: 0 };
  const seenRadioGroups = new Set<string>();

  for (const el of root.querySelectorAll<FormControl>('input, textarea, select')) {
    if (!isFillable(el)) continue;
    if (el instanceof HTMLSelectElement && el.selectedIndex > 0) continue; // user already picked something
    const isRadio = el instanceof HTMLInputElement && el.type === 'radio';
    if (isRadio) {
      if (seenRadioGroups.has(el.name)) continue;
      seenRadioGroups.add(el.name);
    } else if (!(el instanceof HTMLSelectElement) && el.value) {
      continue; // never overwrite what's already there
    }

    const norm = answers.length ? normalizeQuestion(questionText(el)) : '';
    const key = matchField(el);
    const value = key ? data[key] : '';
    const learned = findAnswer(answers, norm, 'exact') ?? (key && value ? undefined : findAnswer(answers, norm, 'similar'));

    let variants: string[];
    let text: string;
    if (learned) {
      variants = learnedVariants(learned);
      text = learned.value;
    } else if (key && value) {
      variants = valueVariants(key, value);
      text = value;
    } else {
      continue;
    }

    let ok = false;
    if (el instanceof HTMLSelectElement) {
      ok = fillSelect(el, variants);
    } else if (isRadio) {
      ok = fillRadio(el, variants);
    } else {
      setNativeValue(el, text);
      ok = true;
    }

    if (ok) {
      highlight(el);
      result.filled++;
      if (learned) result.fromLearned++;
      else result.fields.push(key!);
    }
  }

  if (extras.resume) result.resumes = attachResume(extras.resume, root);
  return result;
}
