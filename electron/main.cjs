/**
 * The desktop shell.
 *
 * The editor is the same code that runs in a tab; what the shell adds is the
 * three things a browser cannot do. Files are read and written straight from
 * disk through native dialogs instead of the File System Access API, which
 * refuses to work from `file://` anyway. And a PDF is *rendered*, not printed:
 * `printToPDF` runs the same Chromium layout the on-screen pagination was
 * measured against, and hands back the bytes — so exporting writes the file
 * and that is the whole interaction. No print dialog, no destination to pick,
 * no filename stamped in the corner.
 *
 * `preferCSSPageSize` is what keeps that honest: the page box comes from the
 * `@page` rule the export stylesheet injects, so the shell has no second
 * opinion about paper size or margins to drift out of step with.
 */

const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

/** Set by `npm run desktop:dev` to point at the Vite server instead of dist/. */
const DEV_URL = process.env.HWP_DEV_URL;
/** Boot, report, quit — for checking the shell without leaving a window open. */
const SMOKE = process.env.HWP_SMOKE === '1';

const DOCUMENT_FILTERS = [
  { name: 'HTML document', extensions: ['html', 'htm'] },
  { name: 'Hyperdraft document (older)', extensions: ['hyd', 'hwpd'] },
];

const MARKDOWN_FILTERS = [{ name: 'Markdown', extensions: ['md', 'markdown'] }];

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 940,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: '#eef0f4',
    title: 'Hyperdraft',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (DEV_URL) mainWindow.loadURL(DEV_URL);
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // Links to the outside world open in the user's browser, not in the document
  // window — a word processor that can navigate away from itself is a bug.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (SMOKE) {
    mainWindow.webContents.once('did-finish-load', async () => {
      if (process.env.HWP_SMOKE_PDF) {
        // Drive the app's own export, button for button.
        await mainWindow.webContents.executeJavaScript(`
          (async () => {
            const size = ${JSON.stringify(process.env.HWP_SMOKE_SIZE || 'Letter')};
            const select = [...document.querySelectorAll('.app-titlebar select')].pop();
            if (select && select.value !== size) {
              select.value = size;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              await new Promise((r) => setTimeout(r, 900));
            }
            document.querySelector('button[data-tip^="Export PDF"]').click();
          })()
        `);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      const report = await mainWindow.webContents.executeJavaScript(
        `({
           title: document.title,
           pages: document.querySelectorAll('.hwp-sheet').length,
           words: document.querySelector('.app-statusbar')?.textContent ?? '',
           bridge: typeof window.hwpDesktop,
         })`,
      );
      console.log('SMOKE', JSON.stringify(report));
      app.quit();
    });
  }
}

ipcMain.handle('hwp:open-document', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open document',
    filters: DOCUMENT_FILTERS,
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const file = result.filePaths[0];
  return { path: file, contents: await fs.readFile(file, 'utf8') };
});

ipcMain.handle('hwp:save-document', async (_event, { contents, suggestedName, path: target, kind }) => {
  let file = target;
  if (!file) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: kind === 'markdown' ? 'Export markdown' : 'Save document',
      defaultPath: suggestedName,
      filters: kind === 'markdown' ? MARKDOWN_FILTERS : DOCUMENT_FILTERS,
    });
    if (result.canceled || !result.filePath) return null;
    file = result.filePath;
  }
  await fs.writeFile(file, contents, 'utf8');
  return { path: file };
});

ipcMain.handle('hwp:export-pdf', async (_event, { suggestedName }) => {
  // Under HWP_SMOKE the destination is given, so the whole export path can be
  // exercised without a human to answer a native dialog.
  const result = SMOKE
    ? { canceled: false, filePath: process.env.HWP_SMOKE_PDF }
    : await dialog.showSaveDialog(mainWindow, {
        title: 'Export PDF',
        defaultPath: suggestedName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
  if (result.canceled || !result.filePath) return null;

  // The renderer has already switched into export geometry and is holding it
  // until this resolves, so the page is in exactly the state to render.
  const pdf = await mainWindow.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
  });
  await fs.writeFile(result.filePath, pdf);
  return { path: result.filePath };
});

ipcMain.handle('hwp:print', async () => {
  await new Promise((resolve) => mainWindow.webContents.print({ printBackground: true }, resolve));
  return true;
});

ipcMain.handle('hwp:reveal', async (_event, target) => {
  shell.showItemInFolder(target);
  return true;
});

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
