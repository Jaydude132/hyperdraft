# Hyperdraft

A word processor whose document *is* a web page. You type into it like Word —
paginated sheets, a formatting toolbar, Cmd+P for paper — but the file it
produces is a single self-contained `.html`: semantic markup plus the
stylesheet that renders it.

```
npm install
npm run dev        # http://localhost:5173
npm run check      # layout regression check (needs the dev server running)
```

## Files

Documents save as **`.html`**. The bytes were always self-contained HTML, and
a private extension only made that harder to act on — a file you cannot
double-click into a browser is worth less than one you can, and the stylesheet
travels inside either way. `.hyd` and `.hwpd`, both of which this wrote at some
point, still open; neither is written any more.

There are two export paths beside it, on one toolbar button: **PDF**, which is
the document's pages exactly as measured, and **Markdown**, which is the
document's content with every trace of the styling model removed.

Several documents can be open at once. The tab strip appears only when there
is more than one — a row of chrome that always says the same thing is a row
that could have been page — and unsaved documents are set in italic with an
asterisk, two signals rather than one because italic alone is easy to miss in
a row of names. New documents come from the toolbar or ⌘N and inherit the
theme and paper of the one being worked on, which is nearly always right when
writing a set of them. One editor serves every tab: switching is instant and
the pagination pass only ever measures one document, at the cost of a per-tab
undo history.

A saved file carries the document stylesheet, the print rules and the syntax
highlighting baked in, so it renders and prints correctly with no application
present. What it cannot carry is pagination: the page breaks are measured by
the editor, so a standalone file is one continuous column on screen and
paginates only when the browser prints it.

In a browser tab, **Export as PDF** does not go through the print dialog's
"Save as PDF", because
that route lets the browser stamp the filename, date and URL into the page
corners and a page cannot switch those off. They exist because `@page` reserves
a margin for the browser to draw them in — so the export gives the page *no*
margin and supplies the document's own margins from inside the flow instead.
With nowhere to put them, the browser omits them entirely.

That works because the editor has already paginated exactly. Dropping the
on-screen gutter makes the flow's stride precisely one page tall, with the page
margins already sitting inside it as the spacers the measurement pass computed;
the browser then cuts every 11in and lands on the boundaries the screen shows.
The PDF is the screen, page for page. See `io/exportPdf.ts`.

The browser still owns the last step there — a page cannot write a PDF to disk
without either the print pipeline or drawing the file itself, and drawing it
means giving up real text for pixels or re-implementing text layout that the
browser already does perfectly. The desktop shell below removes that step
rather than working around it.

## The idea

Everything the toolbar does is HTML and CSS. A "Section" is a `<section>` with
a border radius. A table has rounded corners because the corner cells carry a
radius. A figure is inline SVG. Nothing is a proprietary blob, and the saved
file opens and prints correctly in any browser with no application present.

## How pagination works

This is the part that is easy to get wrong, so it is worth stating plainly:
**there are two pagination engines, and they are deliberately different.**

**On screen** — live and measured. The editor is one continuous
`contenteditable` column sitting on top of drawn sheets. After every change,
`src/editor/pagination.ts` walks the top-level blocks and inserts spacers that
push content across sheet boundaries. Blocks break one of two ways:

- **Whole-block** — a bordered section or heading that will not fit moves to
  the next page intact.
- **Line-level** — a paragraph or code block splits at a real line box. The
  pass reconstructs the block's line geometry, finds the line that crosses the
  boundary, resolves that line's first character to a document position, and
  inserts a block-level spacer there. Text after it reflows in a fresh
  anonymous block, which is why wrapping either side of the break is unchanged.
  Orphan and widow control (`MIN_LINES`) mirrors the `orphans`/`widows` values
  in the print stylesheet — if those two disagree, a paragraph breaks in a
  different place on paper than it does on screen.
- **Row-level** — a table splits between rows. It cannot use a spacer: a
  `<div>` between two `<tr>`s is invalid and gets hoisted out of the table, and
  inserting any element would renumber `nth-child` and shift the banded-row
  pattern at every page boundary. So a row break decorates the row itself and
  opens the gap with padding on that row's cells.

Splitting a block that draws a visible box is only possible because of the
**page mask** (`PageSheets.tsx`): a layer painted *over* the text that fills
each page's margins in the sheet colour and each gutter in the canvas colour.
Without it, the single element spanning the break would draw its border and
background straight through the gap between sheets.

Every one of those breaks is screen-only and must leave no trace on paper —
spacers are `display: none` in print and row padding is reset to zero, or the
browser would paginate around spacing that does not exist and drift onto extra
pages.

The spacers are ProseMirror **widget decorations**, which is the whole trick:
they never enter the document, the undo history, the saved file, or the print
output. The document model has no concept of a page.

**On paper** — real, exact. `src/styles/print.css` hands the same continuous
flow to the browser's own paged-media engine: `@page { size: Letter; margin:
1in }`, `break-inside: avoid` on sections and table rows, orphan and widow
control on paragraphs. The app chrome and the spacers are display-none'd.

The two agree because both read the same geometry from
`src/editor/geometry.ts`. If that file is ever bypassed, the screen stops
predicting the paper. `npm run check` exists to catch exactly that: it drives a
real browser, asserts no block straddles a sheet boundary, and asserts the
printed PDF has the same page count the screen reports.

## Tables

Hovering near a table raises Word's selection grips in the page margin: click
one to select a whole row or column, drag along them to extend, click the
corner for the whole table. Right-click inside a table for rows, columns,
merge/split and header toggling; the same operations appear in a contextual
ribbon whenever the caret is in a table. Columns resize by dragging their
edges. Code blocks and bordered sections raise their own ribbon on the same
row, and the innermost block wins: a code block inside a section is a code
block, not a section.

A right-click inside a cell selection deliberately keeps that selection. That
needs more than it sounds: `mousedown` fires before `contextmenu`, and the
browser's own caret move is read back by ProseMirror's DOM observer *after* the
menu has been built — so the menu would act on a single cell instead of the
column you selected.

**Table styles** is Word's borders-and-shading dialog backed by CSS, in tabs:
a **gallery** of built-in styles, **Borders** (style, weight, colour, which
edges to stamp, cell shading), **Header**, **Rows** (banding and inner rules)
and **Corners**. One group shows at a time on purpose —
as a single column of every control it had, the panel grew tall enough to
cover the document it was styling, and the thing being styled is the thing you
need to see.

The gallery's eight styles are complete appearances rather than patches: every
attribute a table understands appears in each one, with `null` meaning "follow
the theme". That is what makes a gallery behave the way people expect — picking
a style replaces the last one instead of layering onto it, so the cards stay
honest no matter what order they are clicked in. Each card is a real table
rendered through the document stylesheet at 42% and scaled down, so a card
cannot promise a look the document will not deliver. See
`editor/tablePresets.ts`.

The **Header row** section is where a table gets its voice: whether the first
row is a header at all, its fill and text colour, weight, alignment, letter
case (normal, caps, small caps) and a heavier rule beneath it. Each lands as a
custom property with a theme fallback, so a table that has never been near the
panel looks exactly as it always did. Turning the header row off converts its
cells to body cells — a structural change, and the one Cancel can still undo,
because a header cell and a body cell occupy the same span and can be swapped
back in place.

The panel has **OK** and **Cancel**. Controls apply live, so without a way out
the only undo would be Cmd+Z, repeatedly; Cancel restores the styling exactly
as it stood when the panel opened, and touches nothing else — only appearance
attributes are captured, never text, so anything typed while it was open
survives. See `editor/tableSnapshot.ts`.

**What a control acts on follows the selection.** Highlight some cells and the
styling lands on those cells; put the caret anywhere in a table without picking
particular cells — or select the whole table — and it lands on the table. The
panel says which is in force at the top, because silently doing the other thing
is indistinguishable from doing nothing. Controls that are table-wide by nature
(corner radius, banded rows, everything under the header row) disable
themselves rather than being quietly ignored. See `editor/tableScope.ts`.

Borders can be stamped on all, outside, inside, or one edge. "Outside" and
"inside" are relative to the *selection* rather than the table, which is what
makes "give this column a right border" mean the column's outer edge instead of
every cell's.

## Shape

Corners and elevation are shared by tables, sections, code blocks and images.
Corners get a group of their own in the styles panel; elevation sits with each
block's style, since a shadow is a look rather than a shape.

**Elevation** is four steps — none, soft, lifted, floating — rather than a free
hand with `box-shadow`. A shadow is a physical claim about how far something
floats, and a document where every table floats at a slightly different height
looks like an accident rather than a design. The steps print as well as draw:
a shadow that vanishes on paper makes the document a different document. See
`editor/shadow.ts`.

**Images** are blocks like any other: aligned, rounded, lifted, and matted —
padding in a fill colour, the frame a photograph gets when it is mounted
rather than pasted. An image is selected rather than entered, so both the
ribbon and the panel find it in the selection rather than among the caret's
ancestors. See `editor/extensions/DocumentImage.ts`.

## Corners

A block's roundness is four numbers, not one. Rounding the top left and bottom
right while leaving the other two square is a deliberate look, and CSS has
always been able to draw it — nothing about a word processor's single "corner
radius" slider was ever a real constraint.

So tables, bordered sections and code blocks share one control, reached from
each block's own styles panel. Click a corner on the little shape and it rounds
or squares; the slider sets how far the rounded ones bend. **All**, **Square**
and **Diagonal** are one-click starts, and **Values** opens a number per corner
for the cases where the four should differ.

The radii travel as custom properties under a prefix per element type —
`--sec-r-tl`, `--code-r-tr`, `--tbl-r-br` — because custom properties inherit,
and a table inside a rounded section would otherwise read the section's corners
as its own. A table keeps a single `radius` while all four agree, which is what
a document saved before any of this existed carries. Rounded corners are also
why a table's `border-collapse` must be `separate`: collapsed borders cannot be
rounded, so each corner cell rounds by the table's corner minus its border
width. See `editor/corners.ts`.

Appearance is stored as CSS custom properties on the `<table>` element itself:

```html
<table style="--tbl-bw: 2px; --tbl-radius: 16px" data-stripe="true">
```

The document stylesheet reads them with theme fallbacks, so an unstyled table
follows the theme and a styled one overrides only what it names. One caveat
worth knowing: with `resizable: true`, prosemirror-tables installs its own table
node view and constructs it without Tiptap's rendered attributes, so a table's
styling reaches the saved file but never the editor. `StyledTableView` exists
solely to close that gap.

## Code blocks

Dark by default, with a light theme and room for more — a theme is an entry in
`CODE_THEMES` plus a `pre[data-code-theme="..."]` block redefining the
`--code-*` and `--tok-*` properties. Syntax highlighted through lowlight as you
type, with a clickable language label and an optional filename in the block's
header, and `Tab` / `Shift-Tab` indenting rather than moving focus.

The header controls are chrome and never print; on paper the same information
is drawn from `data-` attributes by the document stylesheet. They sit inside
padding that `<pre>` reserves rather than stacked above it, because anything
that changed a block's height between screen and paper would desynchronize the
two pagination engines.

Highlighting in the editor is decorations, which never reach `getHTML()`. So
`highlightCodeBlocks` re-runs the highlighter over the body on the way to disk
and bakes the markup in, and the token palette lives in `document.css` rather
than an imported highlight.js theme. A saved document therefore keeps its
colours with no JavaScript anywhere. The language name is drawn with a
pseudo-element from a `data-language` attribute — an element there would be read
back as part of the code on the next open.

## Print and export

One toolbar button, and it exports. There is no screen in front of it: an
export dialog that ends by opening the browser's print dialog is the same
question asked twice. `Cmd+P` prints.

The two paths differ in the page box, which is the whole point. Printing
reserves a margin for the browser to stamp the filename, date and URL into;
exporting gives the page *no* margin and supplies the document's own from
inside the flow, so there is nowhere for that furniture to go. In the desktop
shell the export writes the file outright and no dialog appears at all.

**In a browser, exporting copies the document into a window of its own.** The
editor used to be restyled in place for the length of a print — a class on
`<html>`, a stylesheet appended, the geometry re-paginated, all of it undone
afterwards. That works, but it puts the print dialog on top of a live React
application with a resize observer, a measurement loop and, in development, a
hot-reload socket; anything that moves the page while the preview is rendering
takes the preview with it. The copy is of the live DOM, not a re-render, so the
measured spacers and the mask come along and a paged export still lands on the
boundaries the screen shows. Nothing in the editor is touched and there is
nothing to restore. See `io/exportWindow.ts`.

**The page box follows the paper.** `@page` accepts no custom properties, so
the rule is rewritten whenever the size changes (`io/pageBox.ts`); left
hardcoded it said `Letter` forever, and choosing A4 gave a document measured
for one paper and cut on another — the flow drifting further out of step with
every page. A saved file carries its own copy of the rule and a
`data-page-size` attribute, so an A4 document prints as A4 when opened on its
own, and reopening it restores the paper it was written for.

Printing produces the document and nothing else — toolbars, ribbons, grips,
the page mask and every screen-only spacer are suppressed, and the code
block's live controls are replaced by the same labels drawn from `data-`
attributes.

## Markdown out

Exporting markdown is a deliberate downgrade, and saying so is the point.
Corner radii, banded rows, header fills, themes, page geometry — none of it has
markdown to be written in, so it is dropped rather than smuggled out as HTML.
A bordered section goes the same way: it is styling, so what survives is its
content. An alert is the exception, because `> [!NOTE]` is real markdown.

What comes back is the document's content in the same dialect the editor
reads, so an exported file pasted straight back in rebuilds the structure it
came from — verified by walking the starter document out and back: headings,
tables, code with its language, task lists with their ticks, alerts with their
custom labels, and inline SVG all return intact.

It walks the ProseMirror document rather than the rendered HTML, because the
node types are the thing being converted: an alert is an alert, not a
`<section>` that has to be recognised all over again. See `editor/markdown.ts`.

## Desktop

```
npm run desktop        # build, then open the app
npm run desktop:dev    # alongside `npm run dev`, against the Vite server
```

The shell is the same editor with the three things a browser will not do:

- **Files come from disk.** Native open and save dialogs, writing straight back
  to the path a document came from. The File System Access API refuses to run
  from `file://` at all, so this is not merely nicer — it is what makes a
  packaged app able to open a file.
- **A PDF is rendered, not printed.** `webContents.printToPDF` runs the same
  Chromium layout the on-screen pagination was measured against and hands back
  the bytes, which get written where the save dialog said. No print dialog, no
  destination to choose, nothing to remember. `preferCSSPageSize` keeps the
  page box coming from the export stylesheet's own `@page` rule, so the shell
  has no second opinion about paper to drift out of step with.
- **It is an application.** Its own window, its own icon in the dock, and links
  that open in the browser rather than navigating the document away.

`electron/main.cjs` holds the window and four IPC handlers; `preload.cjs`
exposes exactly those four verbs and nothing else — no `fs`, no `ipcRenderer`.
`io/desktop.ts` is the renderer's view of it, and every caller falls back to
the browser path when it is absent. That rule is the point: this stays a web
app that runs better in a shell, never one that needs the shell to work.

## A trap worth knowing about

`editor.isActive(name)` answers roughly "does this node cover the selection",
and returns **false** for a range selection spanning a whole code block or
table — exactly when a contextual ribbon or a Tab handler most needs it to say
yes. Use `isInsideNode` from `editor/selection.ts` for that question instead.
Three separate bugs came from this one confusion.

## Two rules that are load-bearing

1. **Document blocks carry bottom margins only** (`src/styles/document.css`).
   With no top margins there is no margin collapsing between siblings, so the
   measurement pass can compute exact positions as `height + margin-bottom`.
   Adding a `margin-top` anywhere in the document stylesheet will quietly
   desynchronize screen pagination from print.
2. **Nothing in the document flow is floated or absolutely positioned.** The
   measurement pass assumes normal flow.

## Layout

```
src/
  editor/
    geometry.ts            page sizes, margins, flow stride — one source of truth
    pagination.ts          the measurement pass and its widget decorations
    markdown.ts            the document, as markdown
    starterDocument.ts     the document the app opens with
    highlighting.ts        shared lowlight instance + the save-time highlighter
    extensions/
      Callout.ts           bordered rounded <section>
      CodeBlock.tsx        lowlight code block with a language picker
      PageBreak.ts         explicit break (Cmd+Enter)
      RawHtml.ts           verbatim HTML/SVG escape hatch
      TableStyle.ts        table/cell appearance attributes
      StyledTableView.ts   applies them to the live DOM (see Tables above)
  styles/
    document.css           the document's own stylesheet; embedded into saves
    print.css              @page rules and chrome suppression
electron/
  main.cjs                 window, native dialogs, printToPDF
  preload.cjs              the four-verb bridge
  io/
    documentFile.ts        serialize/parse the self-contained .html
    exportPdf.ts           the no-margin PDF path
    desktop.ts             the shell, if there is one; null in a tab
    pageBox.ts             the @page rule, kept in step with the paper
  components/
    Toolbar.tsx            the main formatting ribbon
    ContextRibbon.tsx      table / code / section ribbon, on its own row
    TabStrip.tsx           open documents, unsaved ones marked
    TableGrips.tsx         Word-style row and column selection handles
    PageSheets.tsx         the sheets, and the mask painted over the gutters
    ContextMenu.tsx        right-click menu
    BordersAndShading.tsx  the table appearance panel
    TableSizePicker.tsx    hover-to-size insert grid
    documentMenu.tsx       builds menu entries from editor state
    icons.tsx              hand-drawn SVG icon set
    SvgCheatSheet.tsx      the reference beside the markup editor
  editor/selection.ts      "is the caret inside this node type?" — see note below
scripts/check-pagination.mjs
```

## Reaching things quickly

Two shortcuts, both about the block under the caret rather than a mode of the
application:

```
⌘⇧M   edit this block as markdown
⌘⇧S   styles for this block — table, section, code block or image
```

Both are also toolbar buttons and right-click entries, because a shortcut
nobody has been told about is not a feature. The styles panel titles itself
after what it found, so there is never a question of what it will act on.

Text alignment — left, centre, right, justify — lives in the toolbar and
applies to headings, paragraphs and the paragraphs inside table cells, which is
what makes a markdown table's `:---:` mean something after it is imported.

## Text

Font family and size are on the main ribbon, backed by `TextStyleKit`, and
both survive the round trip to disk as ordinary inline styles. Typefaces are
system stacks only, so a saved document needs no network to render as written.

The ribbon is one row that scrolls sideways rather than reflowing into more and
more rows — a control that changes position with the window width is one you
have to hunt for. Font, size and paragraph style are the same kind of picker
throughout, showing the theme's own font and size when nothing is set, read off
the rendered document rather than named again in code.

Tooltips are ours rather than the browser's `title`, which waits about a second
before appearing and cannot be hurried — too slow for a ribbon of icon buttons.
Anything carrying `data-tip` gets one.

## Markdown

Input rules fire as you type: `#` through `######` for all six heading levels,
`-` bullet, `1.` numbered, `- [ ]` task, `>` quote, ` ``` ` code, `---` rule,
`:::` bordered section, `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``,
`==highlight==`, `[text](url)`, `![alt](url)`, and a bare URL.

Three backticks open a code block on the third backtick rather than waiting for
a space, and the language is chosen from the picker in the block's own corner —
a better home for it than a fence nobody can see once the block exists.

**Tables** are the one construct that cannot be recognised from a single line:
`| Region | Shipped |` is only a table once the row of dashes underneath says
so. So the delimiter row is what triggers it, and *when* depends on intent — a
row that is explicitly closed (`| --- | ---: |`) converts the instant the last
pipe is typed, while one left open waits for Enter so that someone still adding
columns is not interrupted halfway. The header text carries over, `:---`,
`---:` and `:---:` set the column alignment, and the caret lands in the first
body cell. See `editor/extensions/MarkdownTable.ts`.

**Pasting markdown renders it.** The clipboard's plain text wins whenever it
looks like markdown — headings, fences, pipes, bullets — which is the right
call on intent: text in that shape was written by someone who wants it
rendered, and HTML copied from a web page almost never looks like it. That
also sidesteps the editors that ship an HTML flavour of their own (VS Code's
is a pile of `<div>`s and inline colours) which used to arrive as a code
block — the source pasted in as a picture of itself. Anything that does not
look like markdown falls through to ProseMirror's own paste handling, and
inside a code block markdown stays content rather than format.
`marked` does the parsing; alerts, task lists and column alignment are adapted
afterwards, because a parser cannot know about this schema. Alignment is worth
naming: marked writes `<th align="left">`, which the browser honours and the
schema kept, so an imported table looked right while the markdown serializer —
which reads the paragraph's own alignment — saw nothing to write. Two
representations of one thing is one too many, so an imported cell's alignment
is moved onto the paragraph, where everything else in this editor puts it. See
`editor/extensions/MarkdownPaste.ts`.

**Alerts** are GitHub's, and they are the reason this editor can write
documentation that looks like documentation:

```
> [!NOTE]
> Five kinds: note, tip, important, warning, caution.

> [!IMPORTANT] LOOK AT THIS!
> Anything after the bracket becomes the block's heading instead of the
> default word.
```

Type the marker and press Enter — the quote `>` just made becomes the alert,
and everything typed afterwards lands inside it. The heading is drawn by the
stylesheet from `data-label` rather than written into the document as text,
which is what lets a custom label need no extra markup and keeps the block
identical in the editor, on paper, and in a saved file opened on its own. The
icons are inline data URIs, because nothing may depend on a file that did not
travel with the document. The kind and the label are also on the Section
ribbon, for the times when reaching for the syntax is not what you want.

The six levels descend the whole way: Title, Heading, Subheading, two plainer
levels, and then an eyebrow — level six is too small to compete as a heading,
so it earns its place by looking different rather than merely smaller (small,
uppercase, letter-spaced, faint).

## Editing a block as markdown

**⌘⇧M**, ctrl-click, or the right-click menu turns the block under the caret
into the markdown it would be written as. Edit the text, press ⌘↵ (or Apply),
and it renders again; Esc leaves it as it was. Paragraphs and headings count
as blocks here even though they are already text — their marks are markdown
too, and a shortcut that does nothing where the caret happens to be is a
shortcut people stop reaching for.

This is the way back out of anything the editor has already rendered. Type
`| a | b |` and a row of dashes and it becomes a table immediately; ⌘⇧M is how
you get back to add the colon that left-aligns a column. For anyone
who thinks in markdown this beats any amount of ribbon — retyping a table's
row is a line of pipes rather than eight cell edits.

The block is not replaced while it is being edited. It stays in the document,
hidden by a decoration, with the source shown in a widget beside it, so an
abandoned edit costs nothing and the undo history sees one change rather than
every keystroke — one ⌘Z puts the original table back.

The conversion is the pair the rest of the editor already uses: out through
`documentToMarkdown`, back in through the paste path. So this doubles as the
honest answer to "what does this look like as markdown?" — if a block survives
the round trip, the markdown export can represent it. See
`editor/extensions/SourceMode.tsx`.

## Drawing

The markup editor lays the markup out on the way in — one element per line,
indented by depth, short text kept on the line that opens it — because a raw
block arrives from the document as one unbroken line, and editing that is
miserable. It formats by walking the parsed DOM rather than by matching angle
brackets, so it cannot produce markup that differs from what it was given, and
content whose whitespace matters is passed through untouched. The text is
syntax highlighted by the same highlighter the document uses for code blocks:
a transparent textarea over a painted copy, which keeps a real editing surface
rather than trading it for a contenteditable's selection bugs. See
`io/formatMarkup.ts` and `components/MarkupEditor.tsx`.

It also has an **SVG help** panel beside it:
the coordinate space, the shape elements, the one-letter path grammar, the
painted attributes, and four snippets — a titled panel, a flow with an arrow, a
bar chart, an inline icon — that go in at the caret rather than at the end, so
there is always something working to edit. See `components/SvgCheatSheet.tsx`.

## Known gaps

- **Only top-level blocks split.** A paragraph nested inside a bordered section
  or a table cell still moves whole.
- **Bordered sections never split**, by design — a callout is a semantic unit,
  which is also what `break-inside: avoid` gives it on paper. One taller than a
  page overflows its sheet.
- **Continuation padding above a split code block is screen-only.** The print
  engine fragments the box itself and has no equivalent hook; a dozen pixels at
  a seam is below the threshold that would move a page break.
- **A split table does not repeat its header row.** Tiptap's schema has no
  `thead`, so neither the screen nor `display: table-header-group` in print has
  anything to repeat.
- **No running headers, footers, or page numbers on paper.** Those need
  Paged.js on the export path; the browser's own `@page` margin boxes are not
  broadly supported.
- **Switching documents resets the undo history.** One editor serves every
  tab, so `setContent` clears its history on each switch. Per-tab undo needs
  either an editor per document or a saved history stack.
- **The desktop app is not packaged.** `npm run desktop` runs it; turning that
  into a signed, double-clickable `.app` needs electron-builder and an Apple
  developer certificate, neither of which is set up.
- **`RawHtml` is unsanitized.** Fine for documents you author, a hole if this
  ever opens untrusted files. Sanitize on the parse path.
- **The styles panel stops at corners for sections and code blocks.** Tables
  have the full treatment; a section offers its variant and its corners, a code
  block its theme and its corners. Borders, fills and padding for those two —
  and named styles for headings and body text, which the whole design rests
  on — are not built yet.
