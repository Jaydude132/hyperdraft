/**
 * The bridge. Deliberately four verbs wide: the renderer asks for a document,
 * a save, a PDF or a print, and never sees `fs`, `ipcRenderer`, or anything
 * else it could be talked into misusing. Everything the editor does with the
 * result it already knew how to do in a browser tab.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hwpDesktop', {
  platform: process.platform,
  openDocument: () => ipcRenderer.invoke('hwp:open-document'),
  saveDocument: (options) => ipcRenderer.invoke('hwp:save-document', options),
  exportPdf: (options) => ipcRenderer.invoke('hwp:export-pdf', options),
  print: () => ipcRenderer.invoke('hwp:print'),
  reveal: (target) => ipcRenderer.invoke('hwp:reveal', target),
});
