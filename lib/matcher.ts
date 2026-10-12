import type { ProfileKey } from './profile';

export type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Standard autocomplete tokens → profile key (https://html.spec.whatwg.org/#autofill). */
const AUTOCOMPLETE_MAP: Record<string, ProfileKey> = {
  name: 'fullName',
  'given-name': 'firstName',
  'family-name': 'lastName',
  email: 'email',
  tel: 'phone',
  'tel-national': 'phone',
  organization: 'company',
  'organization-title': 'jobTitle',
  country: 'country',
  'country-name': 'country',
  'address-level1': 'province',
  'address-level2': 'city',
  'address-level3': 'district',
  'street-address': 'street',
  'address-line1': 'street',
  'postal-code': 'postalCode',
  bday: 'birthday',
  sex: 'gender',
  url: 'website',
};

interface Rule {
  key: ProfileKey;
  include: RegExp;
  exclude?: RegExp;
}

/**
 * Keyword rules, checked in order; the first rule that hits any descriptor wins.
 * Specific rules come before generic ones (e.g. ZIP before address, first/last name before name).
 * Keywords cover both English and Chinese forms.
 */
const RULES: Rule[] = [
  { key: 'email', include: /e-?mail|邮箱|电子邮件/ },
  {
    key: 'phone',
    include: /phone|mobile|(^|[^a-z])(cell|tel)([^a-z]|$)|手机|电话|联系方式/,
    exclude: /(^|[^a-z])ext(ension)?([^a-z]|$)|分机/,
  },
  { key: 'postalCode', include: /zip|postal|post[\s_-]?code|邮编|邮政编码/ },
  { key: 'website', include: /website|homepage|blog|个人网站|主页|网址/ },
  { key: 'country', include: /country|nation|国家/, exclude: /code|calling|区号/ },
  { key: 'province', include: /province|(^|[^a-z])state([^a-z]|$)|region|省份|^省$|所在省/ },
  { key: 'city', include: /city|town|城市|^市$|所在市/ },
  { key: 'district', include: /district|county|区县|区\/县|^区$|^县$|所在区/ },
  {
    key: 'street',
    include: /street|address|addr|line[\s_-]?1|地址|街道/,
    // Line 2 (apartment, suite) is left for the user rather than duplicating line 1.
    exclude: /line[\s_-]?2|address[\s_-]?2|addr[\s_-]?2|(^|[^a-z])(apt|apartment|suite|unit)([^a-z]|$)/,
  },
  { key: 'company', include: /company|organi[sz]ation|employer|公司|单位|企业/ },
  { key: 'jobTitle', include: /job[\s_-]?title|position|occupation|职位|职务|岗位/ },
  { key: 'gender', include: /gender|(^|[^a-z])sex([^a-z]|$)|性别/ },
  { key: 'birthday', include: /birth|bday|(^|[^a-z])dob([^a-z]|$)|生日|出生/ },
  { key: 'lastName', include: /last[\s_-]?name|family[\s_-]?name|surname|lname|^姓$|姓氏/ },
  { key: 'firstName', include: /first[\s_-]?name|given[\s_-]?name|fname|forename|^名$/ },
  {
    key: 'fullName',
    include: /name|姓名|名字|联系人|收货人|收件人/,
    exclude: /user|login|account|nick|middle|file|domain|company|search|用户名|账号|昵称/,
  },
];

const TYPE_FALLBACK: Record<string, ProfileKey> = {
  email: 'email',
  tel: 'phone',
  url: 'website',
};

const MAX_LABEL_LEN = 30;

function clean(text: string | null | undefined): string {
  return (text ?? '').replace(/[\s*:：*]+/g, ' ').trim().toLowerCase();
}

function shortText(el: Element | null): string {
  if (!el) return '';
  const text = clean(el.textContent);
  return text.length <= MAX_LABEL_LEN ? text : '';
}

/** Human-visible label text for a control, from the most to least reliable source. */
export function findLabelText(el: FormControl): string[] {
  const out: string[] = [];
  el.labels?.forEach((l) => out.push(clean(l.textContent)));

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      out.push(shortText(el.ownerDocument.getElementById(id)));
    }
  }

  // Common layouts without <label for>: "<span>Name</span><input>" or "<td>Name</td><td><input></td>".
  if (out.every((t) => !t)) {
    out.push(shortText(el.previousElementSibling));
    out.push(shortText(el.parentElement?.previousElementSibling ?? null));
  }
  return out.filter(Boolean);
}

/**
 * Caption of a radio group, e.g. "Gender:" in `<div>Gender: <label><input type=radio>Male</label>…</div>`.
 * A radio's own <label> holds the option ("Male"), not the question, so it is skipped.
 */
function radioGroupLabel(el: HTMLInputElement): string {
  let node: Element | null = el.parentElement;
  for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
    if (node.tagName === 'LABEL') continue;
    const own = [...node.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join('');
    const text = clean(own) || shortText(node.previousElementSibling);
    if (text && text.length <= MAX_LABEL_LEN) return text;
  }
  return shortText(el.closest('fieldset')?.querySelector('legend') ?? null);
}

/** Every descriptor we match rules against, in priority order. */
export function descriptors(el: FormControl): string[] {
  if (el instanceof HTMLInputElement && el.type === 'radio') {
    return [radioGroupLabel(el), clean(el.getAttribute('name')), clean(el.id)].filter(Boolean);
  }
  return [
    ...findLabelText(el),
    clean(el.getAttribute('name')),
    clean(el.id),
    clean(el.getAttribute('placeholder')),
    clean(el.getAttribute('aria-label')),
    clean(el.getAttribute('title')),
  ].filter(Boolean);
}

export function matchField(el: FormControl): ProfileKey | null {
  const ac = (el.getAttribute('autocomplete') ?? '').trim().toLowerCase().split(/\s+/).pop();
  if (ac && AUTOCOMPLETE_MAP[ac]) return AUTOCOMPLETE_MAP[ac];

  const parts = descriptors(el);
  for (const rule of RULES) {
    if (parts.some((p) => rule.include.test(p) && !rule.exclude?.test(p))) return rule.key;
  }

  if (el instanceof HTMLInputElement) return TYPE_FALLBACK[el.type] ?? null;
  return null;
}

const US_STATES: Record<string, string> = {
  al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california', co: 'colorado',
  ct: 'connecticut', de: 'delaware', dc: 'district of columbia', fl: 'florida', ga: 'georgia',
  hi: 'hawaii', id: 'idaho', il: 'illinois', in: 'indiana', ia: 'iowa', ks: 'kansas', ky: 'kentucky',
  la: 'louisiana', me: 'maine', md: 'maryland', ma: 'massachusetts', mi: 'michigan', mn: 'minnesota',
  ms: 'mississippi', mo: 'missouri', mt: 'montana', ne: 'nebraska', nv: 'nevada', nh: 'new hampshire',
  nj: 'new jersey', nm: 'new mexico', ny: 'new york', nc: 'north carolina', nd: 'north dakota',
  oh: 'ohio', ok: 'oklahoma', or: 'oregon', pa: 'pennsylvania', ri: 'rhode island',
  sc: 'south carolina', sd: 'south dakota', tn: 'tennessee', tx: 'texas', ut: 'utah', vt: 'vermont',
  va: 'virginia', wa: 'washington', wv: 'west virginia', wi: 'wisconsin', wy: 'wyoming',
};

const COUNTRY_ALIASES: string[][] = [
  ['united states', 'united states of america', 'usa', 'us', 'america', 'u.s.', 'u.s.a.'],
  ['united kingdom', 'uk', 'gb', 'great britain', 'england', 'britain'],
  ['canada', 'ca'],
  ['australia', 'au'],
  ['china', 'cn', 'chn', '中国', '中国大陆', '中华人民共和国'],
];

/** Alternative spellings of a value, used to match <select> options and radio buttons. */
export function valueVariants(key: ProfileKey, value: string): string[] {
  const v = value.trim().toLowerCase();
  const variants = [v];
  if (key === 'gender') {
    if (/^(m|male|man|男|先生)$/.test(v)) variants.push('male', 'm', 'man', '男', '先生');
    if (/^(f|female|woman|女|女士)$/.test(v)) variants.push('female', 'f', 'woman', '女', '女士');
  }
  if (key === 'country') {
    variants.push(...(COUNTRY_ALIASES.find((names) => names.includes(v)) ?? []));
  }
  if (key === 'province') {
    // "California" should match an option "CA", and vice versa.
    const abbr = Object.keys(US_STATES).find((k) => k === v || US_STATES[k] === v);
    if (abbr) variants.push(abbr, US_STATES[abbr]!);
  }
  if (key === 'province' || key === 'city' || key === 'district') {
    // "广东省" should match an option "广东".
    variants.push(v.replace(/(省|市|区|县|自治区|特别行政区)$/, ''));
  }
  return [...new Set(variants.filter(Boolean))];
}
