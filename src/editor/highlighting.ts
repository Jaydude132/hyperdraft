import { common, createLowlight } from 'lowlight';
import { toHtml } from 'hast-util-to-html';

/**
 * One shared highlighter for both paths that need it: the editor extension,
 * which highlights through ProseMirror decorations while you type, and the
 * file serializer, which bakes the same markup into the saved document so a
 * standalone .html keeps its colours with no JavaScript.
 */
export const lowlight = createLowlight(common);

/** Languages offered in the code block's picker, in menu order. */
export const CODE_LANGUAGES: { value: string; label: string }[] = [
  { value: 'plaintext', label: 'Plain text' },
  { value: 'bash', label: 'Bash' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'css', label: 'CSS' },
  { value: 'diff', label: 'Diff' },
  { value: 'go', label: 'Go' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'ini', label: 'INI / TOML' },
  { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'lua', label: 'Lua' },
  { value: 'makefile', label: 'Makefile' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'objectivec', label: 'Objective-C' },
  { value: 'perl', label: 'Perl' },
  { value: 'php', label: 'PHP' },
  { value: 'python', label: 'Python' },
  { value: 'r', label: 'R' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'rust', label: 'Rust' },
  { value: 'scss', label: 'SCSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'swift', label: 'Swift' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'xml', label: 'HTML / XML' },
  { value: 'yaml', label: 'YAML' },
];

/**
 * Code block themes. Adding one is a matter of an entry here plus a
 * `pre[data-code-theme="..."]` block in document.css that redefines the
 * `--code-*` and `--tok-*` properties.
 */
export const CODE_THEMES: { value: string; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

export function themeLabel(value: string | null | undefined): string {
  return CODE_THEMES.find((theme) => theme.value === value)?.label ?? 'Dark';
}

export function languageLabel(value: string | null | undefined): string {
  if (!value) return 'Plain text';
  return CODE_LANGUAGES.find((language) => language.value === value)?.label ?? value;
}

/**
 * Bake syntax highlighting into serialized HTML.
 *
 * The editor highlights via decorations, which exist only in the view — they
 * never reach `getHTML()`. Without this pass a saved document would open as
 * uncoloured code. Run over the body markup on the way out to disk.
 */
export function highlightCodeBlocks(bodyHtml: string): string {
  const holder = document.createElement('div');
  holder.innerHTML = bodyHtml;

  for (const code of Array.from(holder.querySelectorAll('pre > code'))) {
    const className = code.getAttribute('class') || '';
    const language = /language-([\w-]+)/.exec(className)?.[1] ?? 'plaintext';
    const source = code.textContent ?? '';
    if (!source.trim()) continue;

    try {
      const tree = lowlight.registered(language)
        ? lowlight.highlight(language, source)
        : lowlight.highlightAuto(source);
      code.innerHTML = toHtml(tree);
      code.classList.add('hljs');

      // Carried as an attribute and drawn with ::after. An element here would
      // be read back as part of the code on the next open, and would displace
      // <code> as the first child, which is where the language is parsed from.
      code.parentElement?.setAttribute('data-language', languageLabel(language));
    } catch {
      // An unknown grammar is not worth failing a save over; the block simply
      // stays plain, exactly as it looks in the editor.
    }
  }

  return holder.innerHTML;
}
