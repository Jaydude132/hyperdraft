/**
 * Layout regression check.
 *
 * The core risk in this project is silent pagination drift: a CSS change that
 * lets a block straddle a sheet boundary on screen, or that makes the printed
 * page count disagree with the measured one. Both are invisible in a unit test
 * and obvious in a browser, so this drives a real one.
 *
 *   npm run dev                              # in another terminal
 *   npm run check
 *   npm run check -- http://localhost:5199   # against a different port
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

// Only tails in front of content that could have moved up count against the
// build. See the classification below.
const gradedTail = (list) => list.reduce((worst, t) => (t.blocking ? worst : Math.max(worst, t.unusedPx)), 0);

const url = process.argv[2] || 'http://localhost:5173/';
const outDir = process.argv[3] || 'artifacts';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });

const consoleErrors = [];
page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
page.on('pageerror', (error) => consoleErrors.push(String(error)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('.ProseMirror');
await page.waitForTimeout(1200);

// Documents are continuous by default now, which has no page breaks to check.
// Everything below is about the paged layout, so switch into it first.
await page.click('.app-titlebar button[data-tip^="Layout"]');
await page.waitForTimeout(300);
await page.click('.tb-picker-option:text-is("Pages")');
await page.waitForTimeout(2000);


const probe = () => page.evaluate(() => {
  const stack = document.querySelector('.hwp-page-stack');
  const flow = document.querySelector('.ProseMirror');
  const styles = getComputedStyle(stack);
  const stride = parseFloat(styles.getPropertyValue('--stride'));
  const contentHeight = parseFloat(styles.getPropertyValue('--content-h'));
  const flowTop = flow.getBoundingClientRect().top;

  // Every line of text in the document, in flow coordinates. Working at line
  // granularity rather than block granularity is what makes this valid now
  // that paragraphs, code blocks and tables split across pages: a split block
  // is *supposed* to span a boundary, and only its individual lines are not.
  const range = document.createRange();
  const lines = [];
  for (const el of flow.querySelectorAll('p, li, h1, h2, h3, h4, td, th, pre, blockquote')) {
    if (el.querySelector('p, li, td, th')) continue; // leaf blocks only
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue.trim()) continue;
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.height <= 0 || rect.width <= 0) continue;
        lines.push({
          top: rect.top - flowTop,
          bottom: rect.bottom - flowTop,
          text: (node.nodeValue || '').slice(0, 40),
        });
      }
    }
  }

  // The invariant: no line of text may sit in the gutter between two pages,
  // which is the space a page break is supposed to skip over.
  const inGutter = [];
  const bottoms = new Map();
  for (const line of lines) {
    const middle = (line.top + line.bottom) / 2;
    const page = Math.floor(middle / stride);
    const offsetInPage = middle - page * stride;
    if (offsetInPage > contentHeight) {
      inGutter.push({ page: page + 1, atPx: Math.round(offsetInPage - contentHeight), text: line.text });
    }
    bottoms.set(page, Math.max(bottoms.get(page) ?? 0, line.bottom));
  }

  // Unused space at the foot of each page. Large tails mean a block moved to
  // the next page whole when it could have been broken.
  const tails = [];
  const lastPage = bottoms.size ? Math.max(...bottoms.keys()) : 0;
  const firstOnPage = new Map();
  for (const el of flow.querySelectorAll('p, h1, h2, h3, h4, li, table, section, pre, blockquote')) {
    const page = Math.floor((el.getBoundingClientRect().top - flowTop + 0.5) / stride);
    if (!firstOnPage.has(page)) firstOnPage.set(page, el);
  }
  for (const [page, bottom] of [...bottoms].sort((a, b) => a[0] - b[0])) {
    if (page === lastPage) continue;
    const next = firstOnPage.get(page + 1);
    /* A gap in front of a block that is meant to stay whole is the feature,
       not a regression: sections never split, and tables and code blocks only
       split when they cannot fit a page on their own. A heading held back to
       stay with what it introduces is the same thing. */
    const held = next && (
      next.closest('section.hwp-callout') ? 'section'
      : next.closest('table') ? 'table'
      : next.closest('pre') || next.closest('.hwp-codeblock') ? 'code'
      : /^H[1-6]$/.test(next.tagName) ? 'heading'
      : null
    );
    const blocking = held;
    tails.push({
      page: page + 1,
      unusedPx: Math.round(page * stride + contentHeight - bottom),
      blocking,
    });
  }

  return {
    pages: document.querySelectorAll('.hwp-sheet').length,
    blocks: flow.children.length,
    lines: lines.length,
    straddling: inGutter,
    tails,
    splitParagraphs: [...flow.querySelectorAll('p .hwp-page-spacer')].length,
    splitBlocks:
      flow.querySelectorAll('.hwp-page-spacer').length + flow.querySelectorAll('tr.hwp-row-break').length,
  };
});

const measured = await probe();

const LONG_SENTENCE =
  'The measurement pass reads the line boxes of this paragraph, finds the one that crosses the sheet boundary, resolves its first character to a document position, and inserts a block-level spacer there so the remainder flows onto the next page. ';

async function stress() {
  await page.evaluate((sentence) => {
    const editor = window.hwpEditor;
    editor.commands.setContent(
      '<h1>Split stress</h1>' +
        ['<p>' + sentence.repeat(9) + '</p>', '<p>' + sentence.repeat(14) + '</p>'].join(''),
      { emitUpdate: true },
    );
  }, LONG_SENTENCE);
  await page.waitForTimeout(1800);
  return probe();
}

const stressed = await stress();

await page.evaluate(() => window.hwpEditor.commands.undo());
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/screen.png` });
await page.pdf({ path: `${outDir}/print.pdf`, printBackground: true, preferCSSPageSize: true });
await browser.close();

const { readFileSync } = await import('node:fs');
const pdf = readFileSync(`${outDir}/print.pdf`);
const printedPages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const worstTail = gradedTail(measured.tails);

const failures = [];
if (stressed.splitParagraphs < 1) failures.push('a paragraph spanning a page boundary did not split at a line');
if (stressed.straddling.length) failures.push(`stress: ${stressed.straddling.length} line(s) of text sit in a page gutter`);
const stressTail = gradedTail(stressed.tails);
if (stressTail > 80) failures.push(`stress: ${stressTail}px of unused space at the foot of a page`);
if (measured.straddling.length) failures.push(`${measured.straddling.length} line(s) of text sit in a page gutter`);
// One line of body copy is ~24px. A tail beyond this means content that could
// have flowed onto the page was pushed off it instead.
if (worstTail > 80) failures.push(`${worstTail}px of unused space at the foot of a page`);
if (printedPages !== measured.pages) failures.push(`printed ${printedPages} pages, screen shows ${measured.pages}`);
if (consoleErrors.length) failures.push(`${consoleErrors.length} console error(s)`);

console.log(`blocks           ${measured.blocks}  (${measured.lines} lines)`);
console.log(`screen pages     ${measured.pages}`);
console.log(`printed pages    ${printedPages}`);
console.log(`split blocks     ${measured.splitBlocks}`);
console.log(`stress: pages ${stressed.pages}, splits ${stressed.splitParagraphs}, worst tail ${stressed.tails.reduce((w, t) => Math.max(w, t.unusedPx), 0)}px`);
console.log(`worst page tail  ${worstTail}px  (${measured.tails.map((t) => `p${t.page}:${t.unusedPx}${t.blocking ? `[${t.blocking}]` : ''}`).join(' ') || 'n/a'})`);
console.log(`                 [tag] = gap before an unsplittable block, not counted`);
console.log(`artifacts        ${outDir}/screen.png, ${outDir}/print.pdf`);

if (failures.length) {
  console.error('\nFAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  for (const line of measured.straddling) console.error(`    p${line.page} +${line.atPx}px into the gutter  "${line.text}"`);
  for (const error of consoleErrors) console.error(`    ${error}`);
  process.exit(1);
}
console.log('\nPASS  screen and print agree, no line of text sits in a gutter');
