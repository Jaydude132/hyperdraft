/**
 * The desktop shell, as seen from the editor.
 *
 * Everything here is optional: in a browser tab `desktop()` is null and every
 * caller falls back to the path it already had. That is the rule for this
 * file — the app must stay a web app that runs better in a shell, never one
 * that needs the shell to work.
 */

export type DesktopFile = { path: string; contents: string };
export type DesktopPath = { path: string } | null;

type DesktopBridge = {
  platform: string;
  openDocument: () => Promise<DesktopFile | null>;
  saveDocument: (options: {
    contents: string;
    suggestedName: string;
    path?: string | null;
    /** Which dialog filters to offer. Documents unless said otherwise. */
    kind?: 'document' | 'markdown';
  }) => Promise<DesktopPath>;
  exportPdf: (options: { suggestedName: string }) => Promise<DesktopPath>;
  print: () => Promise<boolean>;
  reveal: (target: string) => Promise<boolean>;
};

declare global {
  interface Window {
    hwpDesktop?: DesktopBridge;
  }
}

export function desktop(): DesktopBridge | null {
  return typeof window === 'undefined' ? null : (window.hwpDesktop ?? null);
}

export function isDesktop(): boolean {
  return desktop() !== null;
}
