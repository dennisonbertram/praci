const { contextBridge, ipcRenderer } = require("electron");

const scanner =
  process.platform === "darwin" || process.platform === "linux"
    ? {
        scanner: {
          state: () => ipcRenderer.invoke("desktop.scanner.state"),
          scan: () => ipcRenderer.invoke("desktop.scanner.scan"),
          cancel: () => ipcRenderer.invoke("desktop.scanner.cancel"),
          setAutoScan: (enabled) => ipcRenderer.invoke("desktop.scanner.setAutoScan", enabled),
          setFolder: (folder) => ipcRenderer.invoke("desktop.scanner.setFolder", folder),
          setScope: (scope) => ipcRenderer.invoke("desktop.scanner.setScope", scope),
          pending: () => ipcRenderer.invoke("desktop.scanner.pending"),
          confirm: (id, storedSha256) =>
            ipcRenderer.invoke("desktop.scanner.confirm", id, storedSha256),
          onState: (listener) => {
            const handler = (_event, state) => listener(state);
            ipcRenderer.on("desktop.scanner.state.changed", handler);
            return () => ipcRenderer.off("desktop.scanner.state.changed", handler);
          },
          onDocument: (listener) => {
            const handler = (_event, document) => listener(document);
            ipcRenderer.on("desktop.scanner.document", handler);
            return () => ipcRenderer.off("desktop.scanner.document", handler);
          },
        },
      }
    : {};

contextBridge.exposeInMainWorld("rakazoDesktop", {
  ...scanner,
  platform: process.platform,
  localSettings: {
    request: (pathname, body) =>
      ipcRenderer.invoke("desktop.localSettings.request", pathname, body),
  },
  window: {
    close: () => ipcRenderer.invoke("desktop.window.close"),
    minimize: () => ipcRenderer.invoke("desktop.window.minimize"),
    toggleMaximize: () => ipcRenderer.invoke("desktop.window.toggleMaximize"),
    focus: () => ipcRenderer.invoke("desktop.window.focus"),
    state: () => ipcRenderer.invoke("desktop.window.state"),
  },
  update: {
    state: () => ipcRenderer.invoke("desktop.update.state"),
    check: () => ipcRenderer.invoke("desktop.update.check"),
    download: () => ipcRenderer.invoke("desktop.update.download"),
    install: () => ipcRenderer.invoke("desktop.update.install"),
  },
  hex: {
    available: () => ipcRenderer.invoke("desktop.hex.available"),
    list: (sinceMs) => ipcRenderer.invoke("desktop.hex.list", sinceMs),
    show: (id) => ipcRenderer.invoke("desktop.hex.show", id),
  },
  speech: {
    status: () => ipcRenderer.invoke("desktop.speech.status"),
    prepare: () => ipcRenderer.invoke("desktop.speech.prepare"),
    forget: () => ipcRenderer.invoke("desktop.speech.forget"),
    transcribe: (wav) => ipcRenderer.invoke("desktop.speech.transcribe", wav),
    onStatus: (listener) => {
      const handler = (_event, status) => listener(status);
      ipcRenderer.on("desktop.speech.status", handler);
      return () => ipcRenderer.off("desktop.speech.status", handler);
    },
  },
  oauth: {
    open: (url) => ipcRenderer.invoke("desktop.oauth.open", url),
    cancel: (url) => ipcRenderer.invoke("desktop.oauth.cancel", url),
    onCallback: (listener) => {
      // The IpcRendererEvent stays in the preload: the renderer only sees the code.
      const handler = (_event, callback) => listener(callback);
      ipcRenderer.on("desktop.oauth.callback", handler);
      return () => ipcRenderer.off("desktop.oauth.callback", handler);
    },
  },
});
