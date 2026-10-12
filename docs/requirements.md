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

### Later (out of scope for now)

- Multiple profiles (personal / work), chosen per site
- Per-site custom mappings: right-click a field and assign it to a profile item, remembered for that site
- Custom fields (any key → value)
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

Fields that match nothing are left untouched.
