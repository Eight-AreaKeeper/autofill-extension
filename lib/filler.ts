import { matchField, valueVariants, findLabelText, type FormControl } from './matcher';
import { withDerived, type Profile, type ProfileKey } from './profile';

export interface FillResult {
  filled: number;
  fields: ProfileKey[];
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

function fillSelect(el: HTMLSelectElement, key: ProfileKey, value: string): boolean {
  const variants = valueVariants(key, value);
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

function fillRadio(el: HTMLInputElement, key: ProfileKey, value: string): boolean {
  const group = el.name
    ? [...el.ownerDocument.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${CSS.escape(el.name)}"]`)]
    : [el];
  if (group.some((r) => r.checked)) return false;
  const variants = valueVariants(key, value);
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

export function fillPage(profile: Profile, root: Document = document): FillResult {
  const data = withDerived(profile);
  const result: FillResult = { filled: 0, fields: [] };
  const seenRadioGroups = new Set<string>();

  for (const el of root.querySelectorAll<FormControl>('input, textarea, select')) {
    if (!isFillable(el)) continue;
    const key = matchField(el);
    const value = key ? data[key] : '';
    if (!key || !value) continue;

    let ok = false;
    if (el instanceof HTMLSelectElement) {
      if (el.selectedIndex > 0) continue; // user already picked something
      ok = fillSelect(el, key, value);
    } else if (el instanceof HTMLInputElement && el.type === 'radio') {
      if (seenRadioGroups.has(el.name)) continue;
      seenRadioGroups.add(el.name);
      ok = fillRadio(el, key, value);
    } else {
      if (el.value) continue; // never overwrite what's already there
      setNativeValue(el, value);
      ok = true;
    }

    if (ok) {
      highlight(el);
      result.filled++;
      result.fields.push(key);
    }
  }
  return result;
}
