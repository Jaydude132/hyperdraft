import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { marked } from 'marked';
import { defaultAlertLabel } from './Callout';

/**
 * Pasting markdown renders it.
 *
 * Typing markdown has always worked — the input rules fire as you go — but
 * pasting a file's worth of it did nothing useful: the clipboard's plain text
 * arrived as plain text, and an editor's HTML flavour (VS Code ships one, all
 * `<div>`s and inline colours) arrived as a code block, which is the one shape
 * nobody wants.
 *
 * So the plain text wins whenever it looks like markdown. That is the right
 * call on intent: text carrying headings, fences, pipes or bullets was written
 * as markdown by someone who wants it rendered, and rendered HTML copied from
 * a web page almost never looks like that. Everything else falls through to
 * ProseMirror's own paste handling, so copying between documents, or in from a
 * page, behaves exactly as before.
 */

/** Any one of these is enough. Prose does not accidentally look like this. */
const SIGNALS: RegExp[] = [
  /^#{1,6}[ \t]+\S/m, // headings
  /^```/m, // fenced code
  /^[ \t]*[-*+][ \t]+\S/m, // bullets
  /^[ \t]*\d+[.)][ \t]+\S/m, // numbered lists
  /^[ \t]*>[ \t]?\S/m, // quotes and alerts
  /^[ \t]*\|.*\|[ \t]*$/m, // table rows
  /^[ \t]*(-{3,}|\*{3,}|_{3,})[ \t]*$/m, // thematic breaks
  /\[[^\]\n]+\]\([^)\s]+\)/, // links and images
  /(\*\*|__)\S[\s\S]*?\1/, // strong
  /`[^`\n]+`/, // code spans
];

function looksLikeMarkdown(text: string): boolean {
  return text.trim().length > 0 && SIGNALS.some((signal) => signal.test(text));
}

/** `> [!NOTE]` and friends, which marked leaves as an ordinary quote. */
const ALERT_LINE = /^\[!(note|tip|important|warning|caution)\][ \t]*(.*)$/i;

function adoptAlerts(root: Document): void {
  for (const quote of [...root.querySelectorAll('blockquote')]) {
    const first = quote.firstElementChild;
    if (!first || first.tagName !== 'P') continue;

    // marked joins the marker and the first line of body into one paragraph,
    // so the marker has to come off the front of its text rather than off the
    // front of the block.
    const [head, ...rest] = (first.textContent ?? '').split('\n');
    const match = ALERT_LINE.exec(head.trim());
    if (!match) continue;

    const kind = match[1].toLowerCase();
    const label = match[2].trim();
    const section = root.createElement('section');
    section.className = 'hwp-callout';
    section.setAttribute('data-variant', 'plain');
    section.setAttribute('data-alert', kind);
    section.setAttribute('data-label', label || defaultAlertLabel(kind));

    const remainder = rest.join('\n').trim();
    if (remainder) first.textContent = remainder;
    else first.remove();

    while (quote.firstChild) section.appendChild(quote.firstChild);
    if (!section.firstChild) section.appendChild(root.createElement('p'));
    quote.replaceWith(section);
  }
}

/** GitHub's task lists, in the shape the task-list extension parses. */
function adoptTaskLists(root: Document): void {
  for (const list of [...root.querySelectorAll('ul')]) {
    const items = [...list.children].filter((child) => child.tagName === 'LI');
    const box = (item: Element) => item.querySelector('input[type="checkbox"]');
    if (!items.some(box)) continue;

    /* A markdown list can mix `- [ ] task` with plain bullets, but the schema
       cannot: a task list holds task items and nothing else. So consecutive
       runs are split into one list each, which keeps every item's real kind
       instead of promoting a bullet into a task nobody wrote. */
    const runs: { tasks: boolean; items: Element[] }[] = [];
    for (const item of items) {
      const tasks = Boolean(box(item));
      const last = runs[runs.length - 1];
      if (last && last.tasks === tasks) last.items.push(item);
      else runs.push({ tasks, items: [item] });
    }

    const rebuilt = runs.map((run) => {
      const group = root.createElement('ul');
      if (!run.tasks) {
        group.append(...run.items);
        return group;
      }

      group.setAttribute('data-type', 'taskList');
      for (const item of run.items) {
        const checkbox = box(item);
        const checked = Boolean(checkbox?.hasAttribute('checked'));
        checkbox?.remove();

        item.setAttribute('data-type', 'taskItem');
        item.setAttribute('data-checked', String(checked));

        const label = root.createElement('label');
        const input = root.createElement('input');
        input.setAttribute('type', 'checkbox');
        if (checked) input.setAttribute('checked', 'checked');
        label.append(input, root.createElement('span'));

        const content = root.createElement('div');
        while (item.firstChild) content.appendChild(item.firstChild);
        // A tight list item holds bare text; the schema wants a paragraph.
        if (!content.querySelector('p')) {
          const paragraph = root.createElement('p');
          while (content.firstChild) paragraph.appendChild(content.firstChild);
          content.appendChild(paragraph);
        }
        // Trim the space left where the checkbox was.
        const first = content.querySelector('p');
        if (first) first.innerHTML = first.innerHTML.replace(/^\s+/, '');

        item.replaceChildren(label, content);
        group.appendChild(item);
      }
      return group;
    });

    list.replaceWith(...rebuilt);
  }
}

/**
 * Column alignment, moved from the cell to the paragraph inside it.
 *
 * marked writes `<th align="left">`, which the browser honours and the schema
 * keeps — so the table looked right and yet the markdown serializer, which
 * reads the paragraph's own alignment, saw nothing to write. Two
 * representations of one thing is one too many: everything that aligns text in
 * this editor aligns the paragraph, so an imported table does the same.
 */
function adoptCellAlignment(root: Document): void {
  for (const cell of [...root.querySelectorAll('th[align], td[align]')]) {
    const align = cell.getAttribute('align');
    cell.removeAttribute('align');
    if (!align) continue;

    const only = cell.children.length === 1 ? cell.firstElementChild : null;
    if (only?.tagName === 'P') {
      (only as HTMLElement).style.textAlign = align;
      continue;
    }

    const paragraph = root.createElement('p');
    paragraph.style.textAlign = align;
    while (cell.firstChild) paragraph.appendChild(cell.firstChild);
    cell.appendChild(paragraph);
  }
}

export function markdownToHtml(text: string): string {
  const html = marked.parse(text, { gfm: true, async: false }) as string;
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  adoptAlerts(parsed);
  adoptTaskLists(parsed);
  adoptCellAlignment(parsed);
  return parsed.body.innerHTML;
}

export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData('text/plain') ?? '';
            if (!looksLikeMarkdown(text)) return false;

            // Inside a code block, markdown is the content, not the format.
            const { $from } = view.state.selection;
            for (let depth = $from.depth; depth >= 0; depth -= 1) {
              if ($from.node(depth).type.name === 'codeBlock') return false;
            }

            const html = markdownToHtml(text);
            if (!html.trim()) return false;

            // A single paragraph pasted into a sentence should stay inline
            // rather than splitting the block it landed in.
            const parsed = new DOMParser().parseFromString(html, 'text/html');
            const only = parsed.body.children.length === 1 ? parsed.body.firstElementChild : null;
            const content = only?.tagName === 'P' ? only.innerHTML : html;

            editor.commands.insertContent(content, {
              parseOptions: { preserveWhitespace: false },
            });
            event.preventDefault();
            return true;
          },
        },
      }),
    ];
  },
});
