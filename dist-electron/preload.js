"use strict";
const electron = require("electron");
const adminAPI = {
  config: {
    has: () => electron.ipcRenderer.invoke("config:has"),
    load: () => electron.ipcRenderer.invoke("config:load"),
    save: (cfg) => electron.ipcRenderer.invoke("config:save", cfg),
    clear: () => electron.ipcRenderer.invoke("config:clear")
  },
  pdf: {
    printHtml: (html) => electron.ipcRenderer.invoke("pdf:printHtml", { html })
  }
};
electron.contextBridge.exposeInMainWorld("adminAPI", adminAPI);
