/**
 * The document the app opens with. It is deliberately long enough to spill
 * past the first sheet, so pagination is visible the moment the app loads.
 */
export const STARTER_DOCUMENT = `
<h1>Quarterly Field Report</h1>
<h6>Operations — Q3</h6>
<p>This document is plain HTML styled by a stylesheet that travels with it. Every control in the toolbar applies a semantic element or a named class, never a pile of inline styles, so the file you save stays readable and the whole document restyles when you change the theme.</p>

<section class="hwp-callout" data-variant="note">
<h3>What makes this different</h3>
<p>The bordered box you are reading is a <code>&lt;section&gt;</code> with a CSS border radius. It survives the round trip to disk, prints with the corners intact, and can hold anything a page can hold — headings, lists, tables, even an SVG.</p>
</section>

<h2>Where the numbers landed</h2>
<p>Tables use separated borders so the corners can be rounded, which <code>border-collapse: collapse</code> makes impossible. Right-click inside one for rows, columns and <strong>Table styles</strong> — border weight, colour, inner rules, banded rows, cell shading and a corner radius, which is the control Word has never had.</p>

<table style="--tbl-radius: 16px; --tbl-bc: #c2c8d2" data-stripe="true">
<tbody>
<tr><th>Region</th><th>Shipped</th><th>Variance</th></tr>
<tr><td>Northwest</td><td>1,284</td><td>+6.2%</td></tr>
<tr><td>Gulf Coast</td><td>962</td><td>−1.8%</td></tr>
<tr><td>Great Lakes</td><td>1,517</td><td>+11.4%</td></tr>
</tbody>
</table>

<h2>Code, with a language of its own</h2>
<p>Code blocks are syntax highlighted as you type, and the picker in the corner of the block switches language. The highlighting is baked into the saved file, so a document keeps its colours with no JavaScript anywhere in sight.</p>

<pre><code class="language-typescript">export function geometryFor(size: PageSizeName): Geometry {
  const { width, height } = PAGE_SIZES[size];
  const contentHeight = height - MARGIN * 2;
  return {
    pageWidth: width,
    contentWidth: width - MARGIN * 2,
    contentHeight,
    // How far the flow travels to cross one sheet boundary.
    stride: contentHeight + MARGIN + SHEET_GAP + MARGIN,
  };
}</code></pre>

<p>Inline spans use <code>backticks</code> and pick up the same monospace treatment at a size that sits on the body text baseline.</p>

<h2>Markdown while you type</h2>
<p>Start a line with <code>#</code> through <code>######</code> for the six heading levels, <code>-</code> for a bullet, <code>1.</code> for a numbered list, <code>&gt;</code> for a quote, or <code>:::</code> for a bordered section. Three backticks open a code block. Wrap words in <code>**</code> for <strong>bold</strong>, <code>*</code> for <em>emphasis</em>, <code>==</code> for <mark>highlight</mark>, and write links as <code>[text](url)</code>.</p>

<p>Type a header row and the dashes under it — <code>| Region | Shipped |</code>, then <code>| --- | ---: |</code> — and the two lines become a real table, alignment and all.</p>

<ul data-type="taskList">
<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked><span></span></label><div><p>Task lists come from <code>- [ ]</code>, and the boxes are real checkboxes.</p></div></li>
<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>They save as markup, so a printed copy shows what was ticked.</p></div></li>
</ul>

<section class="hwp-callout" data-variant="plain" data-alert="note" data-label="Note">
<p>GitHub's alerts work too. Type <code>&gt; [!NOTE]</code> and press Enter, or <code>&gt; [!IMPORTANT] LOOK AT THIS!</code> to give the block a heading of your own.</p>
</section>

<h2>Pagination is measured, not guessed</h2>
<p>The editor is one continuous editable column sitting on top of drawn sheets. A measurement pass walks the blocks after every change, works out where each sheet boundary falls, and inserts an invisible spacer to push the next block onto a fresh page. The spacers are view decorations: they never enter the document, the undo history, or the file on disk.</p>
<p>Printing takes a different path entirely. The browser repaginates the same continuous flow against a real <code>@page</code> box, with <code>break-inside: avoid</code> keeping sections and table rows whole and orphan and widow control keeping stray lines off the seam. The two engines agree because they read the same page geometry.</p>
<p>Press <strong>Cmd+Enter</strong> to force a break wherever you want one. Press <strong>Cmd+P</strong> to see the printed result — the page furniture, the toolbar and the spacers all drop away, and what is left is the document.</p>

<section class="hwp-callout" data-variant="plain" data-alert="tip" data-label="Tip">
<p>Paragraphs and code blocks split at a line, tables at a row, and the screen and the printer agree on where. A bordered section still moves whole rather than splitting — the one place the two engines part company.</p>
</section>

<h2>Figures</h2>
<p>Any markup the schema does not model can go into a raw block — an inline SVG, an embedded chart, a hand-written table. It is stored verbatim and written straight back out.</p>

<div class="hwp-raw"><svg viewBox="0 0 420 120" role="img" aria-label="Draft to review to print" style="width:100%;max-width:420px">
  <rect x="6" y="26" width="120" height="68" rx="12" fill="#f4f6fa" stroke="#c2c8d2"/>
  <rect x="150" y="26" width="120" height="68" rx="12" fill="#f4f6fa" stroke="#c2c8d2"/>
  <rect x="294" y="26" width="120" height="68" rx="12" fill="#e5ecfb" stroke="#2f5fd0"/>
  <path d="M126 60h24M270 60h24" stroke="#8a919e" stroke-width="1.5"/>
  <path d="M144 56l6 4-6 4M288 56l6 4-6 4" fill="none" stroke="#8a919e" stroke-width="1.5"/>
  <text x="66" y="65" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" fill="#4a5160">Draft</text>
  <text x="210" y="65" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" fill="#4a5160">Review</text>
  <text x="354" y="65" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" fill="#2f5fd0">Print</text>
</svg></div>

<p>Select the figure and use the <code>&lt;/&gt;</code> button to edit its markup directly.</p>
`.trim();
