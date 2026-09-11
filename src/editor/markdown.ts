import type { Node as ProseMirrorNode, Mark } from '@tiptap/pm/model';
import { defaultAlertLabel } from './extensions/Callout';

/**
 * The document, as markdown.
 *
 * This is a deliberate downgrade: everything the styling model knows — corner
 * radii, banded rows, header fills, themes, page geometry — has no markdown to
 * be written in, and is dropped rather than smuggled out as HTML. What comes
 * back is the document's *content*, in the same dialect the editor reads, so a
 * file exported here can be pasted straight back in and rebuild the structure
 * it came from.
 *
 * It walks the ProseMirror document rather than the rendered HTML. The node
 * types are the thing being converted, and reading them directly means an
 * alert is an alert instead of a `<section>` that has to be recognised again.
 */

/** Characters that would otherwise start markup where prose was meant. */
function escapeText(text: string): string {
  return text
    .replace(/([\\`*_[\]<>])/g, '\\$1')
    .replace(/^(\s*)([#>-])/gm, '$1\\$2')
    .replace(/^(\s*\d+)\./gm, '$1\\.');
}

const MARK_WRAPPERS: Record<string, string> = {
  bold: '**',
  italic: '*',
  strike: '~~',
  highlight: '==',
};

function inlineOf(node: ProseMirrorNode): string {
  let out = '';

  node.forEach((child) => {
    if (child.type.name === 'hardBreak') {
      out += '  \n';
      return;
    }
    if (child.type.name === 'image') {
      const alt = (child.attrs.alt as string) ?? '';
      out += `![${alt}](${child.attrs.src})`;
      return;
    }
    if (!child.isText) {
      // Anything else inline is structural; its text is what matters.
      out += child.textContent;
      return;
    }

    const marks = child.marks;
    // Code spans take no other formatting: inside backticks, `**` is two
    // asterisks and nothing more, so the wrappers would be printed verbatim.
    const code = marks.find((mark: Mark) => mark.type.name === 'code');
    let text = code ? `\`${child.text}\`` : escapeText(child.text ?? '');

    if (!code) {
      for (const mark of marks) {
        const wrapper = MARK_WRAPPERS[mark.type.name];
        if (wrapper) text = `${wrapper}${text}${wrapper}`;
      }
    }

    const link = marks.find((mark: Mark) => mark.type.name === 'link');
    if (link) text = `[${text}](${link.attrs.href})`;

    out += text;
  });

  return out;
}

function prefixLines(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((line) => (line ? `${prefix}${line}` : prefix.trimEnd()))
    .join('\n');
}

function listOf(node: ProseMirrorNode, ordered: boolean, task: boolean): string {
  const items: string[] = [];

  node.forEach((item, _offset, index) => {
    const checked = task ? (item.attrs.checked ? '[x] ' : '[ ] ') : '';
    const marker = ordered ? `${index + 1}. ` : '- ';
    const body = blocksOf(item).trim();
    // Continuation lines line up under the first character of the text, which
    // is what keeps a nested list nested.
    const indent = ' '.repeat(marker.length);
    items.push(
      prefixLines(`${checked}${body}`, '')
        .split('\n')
        .map((line, line_index) => (line_index === 0 ? `${marker}${line}` : `${indent}${line}`))
        .join('\n'),
    );
  });

  return items.join('\n');
}

function tableOf(node: ProseMirrorNode): string {
  const rows: { cells: string[]; header: boolean }[] = [];
  const alignments: string[] = [];

  node.forEach((row) => {
    const cells: string[] = [];
    let header = false;
    row.forEach((cell, _offset, index) => {
      if (cell.type.name === 'tableHeader') header = true;
      // A pipe inside a cell would end it early.
      cells.push(blocksOf(cell).replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim());
      if (alignments[index] === undefined) {
        alignments[index] = (cell.firstChild?.attrs.textAlign as string) ?? '';
      }
    });
    rows.push({ cells, header });
  });

  if (rows.length === 0) return '';

  const width = Math.max(...rows.map((row) => row.cells.length));
  const line = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, index) => cells[index] ?? '').join(' | ')} |`;

  const rule = Array.from({ length: width }, (_, index) => {
    const align = alignments[index];
    if (align === 'center') return ':---:';
    if (align === 'right') return '---:';
    if (align === 'left') return ':---';
    return '---';
  });

  // Markdown tables are always headed. A table whose first row is body cells
  // still needs one, or everything after it is discarded by the parser.
  const [first, ...rest] = rows;
  return [line(first.cells), `| ${rule.join(' | ')} |`, ...rest.map((row) => line(row.cells))].join(
    '\n',
  );
}

function blockOf(node: ProseMirrorNode): string {
  switch (node.type.name) {
    case 'heading':
      return `${'#'.repeat(Number(node.attrs.level) || 1)} ${inlineOf(node)}`;

    case 'paragraph':
      return inlineOf(node);

    case 'codeBlock': {
      const language = (node.attrs.language as string) || '';
      const filename = (node.attrs.filename as string) || '';
      // The filename has nowhere to live in a fence, so it goes above as a
      // caption rather than being lost.
      const caption = filename ? `**${filename}**\n\n` : '';
      return `${caption}\`\`\`${language}\n${node.textContent}\n\`\`\``;
    }

    case 'blockquote':
      return prefixLines(blocksOf(node).trim(), '> ');

    case 'callout': {
      const body = blocksOf(node).trim();
      const alert = node.attrs.alert as string | null;
      if (!alert) return body; // A plain section is styling; its content is not.
      const label = (node.attrs.label as string) || '';
      const marker =
        label && label !== defaultAlertLabel(alert)
          ? `[!${alert.toUpperCase()}] ${label}`
          : `[!${alert.toUpperCase()}]`;
      return prefixLines(`${marker}\n${body}`, '> ');
    }

    case 'bulletList':
      return listOf(node, false, false);
    case 'orderedList':
      return listOf(node, true, false);
    case 'taskList':
      return listOf(node, false, true);

    case 'table':
      return tableOf(node);

    case 'horizontalRule':
      return '---';

    case 'image':
      return `![${(node.attrs.alt as string) ?? ''}](${node.attrs.src})`;

    case 'pageBreak':
      // Markdown has no page. Saying so beats dropping it silently.
      return '<!-- page break -->';

    case 'rawHtml':
      return String(node.attrs.html ?? '');

    default:
      return blocksOf(node).trim() || inlineOf(node);
  }
}

function blocksOf(parent: ProseMirrorNode): string {
  const blocks: string[] = [];
  parent.forEach((child) => {
    const text = blockOf(child);
    if (text.trim() || child.type.name === 'paragraph') blocks.push(text);
  });
  return blocks.join('\n\n');
}

export function documentToMarkdown(doc: ProseMirrorNode, title?: string): string {
  const body = blocksOf(doc)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // A title typed into the title bar is not in the document, so it would
  // otherwise be the one thing the export loses.
  const heading = title?.trim();
  const hasOwnTitle = /^#\s/.test(body);
  return `${heading && !hasOwnTitle ? `# ${heading}\n\n` : ''}${body}\n`;
}
