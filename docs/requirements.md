# Requirements and Technical Decisions

## 1. What it is

A browser extension. You enter your personal details (name, phone, email, address and so on) once in the extension. Afterwards, on any web page with a form, you click the extension button and it recognizes the form fields and fills them in for you.

Target users are English-speaking people who repeatedly type the same details into sign-up, checkout, job application, event registration and survey forms. Field recognition also understands Chinese labels, so bilingual sites work too.

## 2. Core flow

1. After installing, open the **My details** page (the options page), fill it in and save.
2. Open a web page that has a form.
3. Click the extension icon in the toolbar and press **Fill this page**.
4. The extension fills the fields it recognizes, briefly highlights them, and the popup shows how many were filled.
5. You review the result and submit the form yourself. The extension **never** submits forms.

## 3. Functional requirements

### MVP (implemented)

| ID | Requirement | Notes |
|---|---|---|
| F1 | Edit personal details | Options page with save and clear; stored locally |
| F2 | One-click fill | Popup button fills the current tab |
| F3 | Field recognition | Rule-based mapping from `autocomplete`, `name`, `id`, `<label>`, `placeholder`, `aria-label` and nearby text, with English and Chinese keywords |
| F4 | Framework compatibility | Values are set through the native setter and `input`/`change` events are dispatched so React/Vue/Angular forms notice them |
| F5 | Never overwrite | Fields that already have a value are skipped |
| F6 | Feedback | Filled fields are briefly outlined; the popup reports the count |
| F7 | Dropdowns and radios | `<select>` options and radio groups are matched by text or value, with aliases (e.g. `CA` ↔ `California`, `US` ↔ `United States`, `Female` ↔ `F`) |
| F8 | Name splitting | A full name fills separate first/last name fields, and vice versa |
| F9 | Learned answers | After a fill, answers the user types into fields the profile doesn't cover are remembered by question text and filled next time; editable on the options page, can be turned off |
| F10 | Resume upload | A resume saved on the options page is attached to resume/CV file inputs (including hidden ones behind drop zones) |

### Later (out of scope for now)

- Multiple profiles (personal / work), chosen per site
- Per-site custom mappings: right-click a field and assign it to a profile item, remembered for that site
- Keyboard shortcut and context-menu fill
- Forms inside iframes and Shadow DOM
- Import/export (JSON), optional encrypted backup
- Localized UI; Firefox and Edge store builds (WXT can produce them from the same code)
- Optional AI-assisted matching for fields the rules miss (opt-in, sends only field descriptions, never your values)

## 4. Non-functional requirements

- **Privacy**: all data stays in `chrome.storage.local` on your device. No network requests, no uploads, no analytics.
- **Sensitive data**: the MVP does not store government ID numbers, card numbers or passwords. If added later they need a separate toggle and local encryption.
- **Safety**: never fills `password`, `hidden`, `disabled`, `readonly` or invisible (often honeypot) fields, and never submits forms.
- **Minimal permissions**: uses `activeTab` + `scripting`, so a script is injected into the current page only when you click. The extension does not request "read and change all your data on all websites", so installation shows no scary warning.
- **Performance**: nothing runs until you click, so there is zero overhead on pages you browse.

## 5. Technology choices

| Area | Choice | Why |
|---|---|---|
| Platform | Chrome Manifest V3 | MV2 is retired; Edge and other Chromium browsers run the same build |
| Language | TypeScript | Type safety for the profile schema and matching rules |
| Build framework | [WXT](https://wxt.dev) (on Vite) | File-based entrypoints, generated manifest, hot reload, one codebase for Chrome/Firefox/Edge; more actively maintained than CRXJS |
| UI | React 18 | Popup and options page; mature ecosystem |
| Storage | `chrome.storage.local` via `wxt/utils/storage` | Local, roomy enough, shared across all extension contexts |
| Page injection | `browser.scripting.executeScript` + `activeTab` | Injected on demand with minimal permissions |
| Tests | Vitest + happy-dom | Unit tests for matching and filling |

## 6. Architecture

```
entrypoints/
  options/               My details page (React)
  popup/                 Toolbar popup with the Fill button (React)
  autofill.content.ts    Fill script, injected on click (not auto-injected)
lib/
  profile.ts             Profile type, field metadata, storage helpers
  matcher.ts             Field recognition: element → profile key
  filler.ts              Walks the page's form controls, sets values, dispatches events, highlights
test/
  sample-form.html       Local test page
  filler.test.ts         Unit tests
```

Fill flow: the popup calls `scripting.executeScript` to inject `content-scripts/autofill.js` into the active tab. The script reads the profile from storage, fills the page, and returns `{ filled, fields }`, which becomes the `executeScript` result the popup displays.

## 7. Field matching strategy

In priority order:

1. **`autocomplete` attribute**: standard tokens (`name`, `given-name`, `email`, `tel`, `postal-code`, `address-level1`, …) map directly. This is the most reliable signal. Section prefixes such as `shipping` are ignored.
2. **Keyword rules**: each control's descriptors (label text, `name`, `id`, `placeholder`, `aria-label`, `title`, or a nearby caption for table layouts and radio groups) are tested against each profile item's regex in order. Specific rules come before generic ones (ZIP before address, first/last name before name). Exclusions keep out look-alikes such as username, middle name, address line 2 and phone extension.
3. **Input type**: `type=email`, `type=tel` and `type=url` as a fallback.

Fields that match nothing are left untouched, unless a learned answer applies (see 8).

## 8. Learned answers

- **When**: after **Fill this page** runs, the injected script listens for `change` events on the page until it is closed. Only trusted (user-generated) events count, so the extension's own fills and the page's scripts are never learned. No new permissions are needed.
- **What**: text inputs, textareas, dropdowns and radio groups whose question the profile doesn't cover, or sentence-style questions (4+ words) where keyword matching is unreliable, e.g. "Have you worked for this company before?".
- **Never**: passwords, payment details, government IDs, one-time codes, search boxes, checkboxes (often consent boxes), and vague labels like "Other" or "Comments".
- **Question text**: label, `aria-labelledby`, `aria-label`, nearby caption, radio group legend, placeholder. `name`/`id` are ignored because application forms often generate them (`question_48213`).
- **Matching**: questions are normalized (case, punctuation, "(optional)"). On fill, an exact match beats the profile; otherwise a near-identical question (Dice similarity ≥ 0.8 over words, or character pairs for Chinese, at least 4 words) is used for fields the profile can't fill. Dropdowns and radios match by the remembered option text or value.
- **Storage**: `local:answers`, one entry per question, newest answer wins.

## 9. Resume upload

- Uploaded once on the options page, stored base64-encoded in `local:resume` (up to 10 MB; the `unlimitedStorage` permission lifts the 10 MB storage cap and shows no install warning).
- A file input counts as a resume field when its label, attributes or nearby text mention resume/CV (English or Chinese) and nothing mentions a cover letter, photo, transcript and similar. As a last resort, the page's only file input counts if the page mentions a resume.
- The input's `accept` list must allow the file. Inputs that already hold a file are skipped. The file is set via `DataTransfer` and `input`/`change` are dispatched so upload widgets react.
- Limitation: forms inside cross-origin iframes (some embedded job boards) are not reached, as with all filling.
