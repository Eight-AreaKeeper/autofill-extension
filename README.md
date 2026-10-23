# Autofill Assistant

A Chrome extension that fills web forms for you. Save your details once, then click **Fill this page** on any sign-up, checkout or application form. Your data never leaves your device.

- Recognizes fields by `autocomplete`, labels, `name`/`id`, placeholders and nearby text (English and Chinese)
- Fills text inputs, dates, dropdowns and radio buttons, including aliases like `CA` ↔ `California`
- Works with React, Vue and other framework-controlled forms
- Learns answers you type into questions your details don't cover ("How did you hear about us?", "Do you need visa sponsorship?") and fills them next time, even when the wording changes slightly
- Attaches your saved resume to resume/CV upload fields on job applications
- Never overwrites what you've typed, never touches password or hidden fields, never submits
- Only runs when you click, using the `activeTab` permission, so it can't read pages in the background. Learning from every form you fill (not just pages where you clicked) is an opt-in on the details page that asks for access to all sites

Requirements and design decisions are in [docs/requirements.md](docs/requirements.md).

## Install from source

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/Eight-AreaKeeper/autofill-extension.git
cd autofill-extension
npm install
npm run build
```

Then load it into Chrome (Edge and other Chromium browsers work the same way):

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `.output/chrome-mv3` folder.
4. Pin **Autofill Assistant** from the puzzle-piece menu so its icon stays in the toolbar.

## Use it

1. Click the extension icon, then **Add my details**. Fill in what you want and press **Save**.
2. Open a page with a form.
3. Click the extension icon, then **Fill this page**. Filled fields flash blue.
4. Answer anything it couldn't fill. Those answers are remembered for the next form; review or delete them under **Learned answers** on the details page. Click **Learn from every form** there so it also learns from the next pages of multi-step forms and from forms where you didn't click Fill.
5. Check the form and submit it yourself.

To attach your resume automatically, upload it once under **Resume** on the details page. Cover letter, photo and other upload fields are left alone.

To try it on the bundled test page, run `npx serve test` in the project folder, open the address it prints and go to `sample-form.html`. If you open the file directly as `file://…`, first enable **Allow access to file URLs** on the extension's details page.

## Development

```bash
npm run dev      # Dev build with hot reload into .output/chrome-mv3-dev (load that folder unpacked)
npm run build    # Production build into .output/chrome-mv3
npm test         # Unit tests
npm run compile  # Type check
npm run zip      # Zip for the Chrome Web Store
```

After `npm run build`, click the reload icon on the extension's card in `chrome://extensions` to pick up changes.

## Project layout

```
entrypoints/options/             My details page
entrypoints/popup/               Toolbar popup (Fill this page)
entrypoints/autofill.content.ts  Fill script, injected into the current tab on click
entrypoints/learn.content.ts     Learning script, run on every site when "Learn from every form" is on
entrypoints/background.ts        Registers the learning script when that setting and access are on
lib/everywhere.ts                The optional all-sites permission
lib/profile.ts                   Profile fields and storage
lib/matcher.ts                   Field recognition rules
lib/filler.ts                    Filling, events and highlighting
lib/learning.ts                  Learned answers: capture, question matching, storage
lib/resume.ts                    Resume storage and upload-field detection
test/                            Test page and unit tests
```

## Privacy

Everything you enter, including learned answers and your resume, is kept in your browser's local extension storage. Passwords, card numbers, ID numbers and verification codes are never learned. The extension makes no network requests and collects no analytics.
