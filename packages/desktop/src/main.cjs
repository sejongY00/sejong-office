const { app, BrowserWindow, dialog, ipcMain, net, protocol, screen, session, shell } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const {
  createDesktopUpdater,
} = require('./autoUpdater.cjs');
const {
  extractFilePathsFromArgv,
  mimeTypeForPath,
  resolveDistAsset,
} = require('./fileArgs.cjs');
const {
  createOfflineAssetManager,
} = require('./offlineCache.cjs');
const {
  buildIframeWindowControlsScript,
} = require('./windowControlsInjector.cjs');

const APP_ORIGIN = 'app://bundle';
const DIST_ROOT = path.resolve(__dirname, '../dist');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

/** Pending files received before any window finishes mounting. */
const startupQueue = [];
/** Map<number (webContents.id), { pendingFiles: string[], ready: boolean, hasOpenedFile: boolean }> */
const windowStates = new Map();
/** True when the renderer already confirmed unsaved changes and requested app exit. */
let confirmedAppExit = false;

// macOS Finder passes files via open-file event (can fire before app is ready)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  if (!app.isReady()) {
    if (!startupQueue.includes(resolved)) startupQueue.push(resolved);
    return;
  }
  dispatchFileToWindow(resolved);
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv, workingDirectory) => {
    const files = extractFilePathsFromArgv(argv, workingDirectory || process.cwd(), __filename);
    if (files.length > 0) {
      for (const file of files) {
        dispatchFileToWindow(file);
      }
    } else {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
      } else {
        createAppWindow();
      }
    }
  });
}

function createAppWindow(initialFiles = []) {
  const iconPngPath = path.join(DIST_ROOT, 'icons/icon-512.png');
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 800,
    minHeight: 560,
    title: 'Sejong Office',
    icon: fs.existsSync(iconPngPath) ? iconPngPath : undefined,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const wcId = win.webContents.id;
  windowStates.set(wcId, {
    pendingFiles: [...initialFiles],
    ready: false,
    hasOpenedFile: initialFiles.length > 0,
  });

  const notifyMaxState = () => {
    if (!win.isDestroyed()) {
      win.webContents.send('sejong:window-maximized-changed', win.isMaximized());
    }
  };
  win.on('maximize', notifyMaxState);
  win.on('unmaximize', notifyMaxState);
  win.on('enter-full-screen', notifyMaxState);
  win.on('leave-full-screen', notifyMaxState);

  // Inject [홈 최소화 최대화 닫기] controls into embedded OnlyOffice and RHWP iframes
  const iframeScript = buildIframeWindowControlsScript();
  win.webContents.on('did-frame-finish-load', (_event, isMainFrame, frameProcessId, frameRoutingId) => {
    if (isMainFrame) return;
    try {
      const { webFrameMain } = require('electron');
      const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
      if (frame) {
        void frame.executeJavaScript(iframeScript).catch(() => {});
      }
    } catch {
      // Ignore frame lookup errors on destroyed frames
    }
  });

  win.on('closed', () => {
    windowStates.delete(wcId);
  });

  // Guard OS-level window close (Cmd+Q / Alt+F4) when a document has unsaved changes
  win.webContents.on('will-prevent-unload', (event) => {
    if (confirmedAppExit) {
      event.preventDefault();
      return;
    }
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['취소', '저장하지 않고 닫기'],
      defaultId: 0,
      cancelId: 0,
      title: '저장하지 않은 변경 사항',
      message: '저장하지 않은 수정이 있습니다. 저장하지 않고 계속할까요?',
    });
    if (choice === 1) {
      event.preventDefault();
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const startUrl = initialFiles.length > 0 ? `${APP_ORIGIN}/?launch=1` : `${APP_ORIGIN}/`;
  void win.loadURL(startUrl);
  return win;
}

/**
 * Send a launched file to an idle home window if one exists, otherwise open a new window
 * (matching the PWA's `multiple-clients` / `navigate-new` behavior).
 */
function dispatchFileToWindow(filePath) {
  for (const win of BrowserWindow.getAllWindows()) {
    const state = windowStates.get(win.webContents.id);
    if (state && !state.hasOpenedFile) {
      state.hasOpenedFile = true;
      if (state.ready) {
        win.webContents.send('sejong:open-files', [filePath]);
      } else {
        state.pendingFiles.push(filePath);
      }
      if (win.isMinimized()) win.restore();
      win.focus();
      return;
    }
  }
  createAppWindow([filePath]);
}

function registerIpcHandlers(updater) {
  ipcMain.handle('sejong:update-get-state', () => updater.getState());
  ipcMain.handle('sejong:update-check', () => updater.checkForUpdates({ silent: false }));
  ipcMain.handle('sejong:update-download', () => updater.downloadUpdate());
  ipcMain.handle('sejong:update-install', () => updater.installUpdate());

  ipcMain.handle('sejong:consume-launch-files', (event) => {
    const state = windowStates.get(event.sender.id);
    if (!state) return [];
    state.ready = true;
    const files = [...state.pendingFiles];
    state.pendingFiles.length = 0;
    return files;
  });

  ipcMain.handle('sejong:read-file', async (_event, filePath) => {
    const resolved = path.resolve(String(filePath));
    const [bytes, stat] = await Promise.all([
      fsp.readFile(resolved),
      fsp.stat(resolved),
    ]);
    return {
      path: resolved,
      name: path.basename(resolved),
      bytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      lastModified: Math.floor(stat.mtimeMs),
    };
  });

  ipcMain.handle('sejong:stat-file', async (_event, filePath) => {
    const resolved = path.resolve(String(filePath));
    const stat = await fsp.stat(resolved);
    return {
      lastModified: Math.floor(stat.mtimeMs),
    };
  });

  ipcMain.handle('sejong:write-file', async (_event, filePath, data) => {
    const resolved = path.resolve(String(filePath));
    const buffer = Buffer.from(data);
    await fsp.writeFile(resolved, buffer);
    const stat = await fsp.stat(resolved);
    return {
      lastModified: Math.floor(stat.mtimeMs),
    };
  });

  ipcMain.handle('sejong:window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.handle('sejong:window-toggle-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    if (win.isFullScreen()) {
      win.setFullScreen(false);
      return false;
    }
    if (win.isMaximized()) {
      win.unmaximize();
      return false;
    }
    win.maximize();
    return true;
  });

  ipcMain.handle('sejong:window-is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return Boolean(win && (win.isMaximized() || win.isFullScreen()));
  });

  ipcMain.handle('sejong:window-close', () => {
    confirmedAppExit = true;
    app.quit();
  });

  /**
   * Per-window native cursor-tracking drag loop for iframe headers.
   * Uses Electron's global `screen.getCursorScreenPoint()` in the main process so the window
   * never loses the cursor even when the mouse moves faster than the window frame.
   */
  const activeDrags = new Map();

  function stopWindowDrag(winId) {
    const state = activeDrags.get(winId);
    if (state) {
      clearInterval(state.timer);
      activeDrags.delete(winId);
    }
  }

  ipcMain.on('sejong:window-drag-start', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed() || win.isMaximized() || win.isFullScreen()) return;
    stopWindowDrag(win.id);

    const startCursor = screen.getCursorScreenPoint();
    const [startWinX, startWinY] = win.getPosition();

    const timer = setInterval(() => {
      if (win.isDestroyed()) {
        stopWindowDrag(win.id);
        return;
      }
      const cursor = screen.getCursorScreenPoint();
      const nextX = Math.round(startWinX + (cursor.x - startCursor.x));
      const nextY = Math.round(startWinY + (cursor.y - startCursor.y));
      win.setPosition(nextX, nextY, false);
    }, 8);

    activeDrags.set(win.id, { timer });
  });

  ipcMain.on('sejong:window-drag-move', () => {
    // Handled by the main-process 120Hz global cursor polling loop above
  });

  ipcMain.on('sejong:window-drag-end', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) stopWindowDrag(win.id);
  });
}

app.whenReady().then(async () => {
  try {
    await session.defaultSession.clearStorageData({ storages: ['serviceworkers'] });
  } catch {
    // Ignore storage cleanup errors
  }

  const dockIconPath = path.join(DIST_ROOT, 'icons/icon-512.png');
  if (process.platform === 'darwin' && app.dock && fs.existsSync(dockIconPath)) {
    try {
      app.dock.setIcon(dockIconPath);
    } catch {
      // Ignore dock icon errors
    }
  }

  protocol.handle('app', async (request) => {
    const assetPath = resolveDistAsset(DIST_ROOT, request.url);
    if (!assetPath) {
      return new Response('Not Found', { status: 404 });
    }
    const body = fs.readFileSync(assetPath);
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': mimeTypeForPath(assetPath),
        'access-control-allow-origin': '*',
      },
    });
  });

  // Intercept remote office/HWP/diagram editor assets so bundled Korean fonts, patched AllFonts.js,
  // and persistent disk cache make the app work 100% offline.
  const offlineManager = createOfflineAssetManager({
    distRoot: DIST_ROOT,
    cacheDir: path.join(app.getPath('userData'), 'offline-cache'),
    netFetch: (req) => net.fetch(req, { bypassCustomProtocolHandlers: true }),
  });

  const OFFLINE_CACHED_HOSTS = new Set([
    'editor.sejong.dev',
    'sejongy00.github.io',
    'cdn.jsdelivr.net',
  ]);

  protocol.handle('https', async (request) => {
    try {
      const u = new URL(request.url);
      if (OFFLINE_CACHED_HOSTS.has(u.hostname)) {
        return await offlineManager.handleEditorRequest(request);
      }
    } catch {
      // Fall back to direct network fetch
    }
    return net.fetch(request, { bypassCustomProtocolHandlers: true });
  });

  setTimeout(() => {
    void offlineManager.warmOfflineEditorsInBackground();
  }, 2500);

  let electronAutoUpdater = null;
  try {
    ({ autoUpdater: electronAutoUpdater } = require('electron-updater'));
  } catch {
    // electron-updater optional fallback
  }

  const updater = createDesktopUpdater({
    app,
    BrowserWindow,
    net,
    shell,
    autoUpdater: electronAutoUpdater,
    onBeforeQuitForUpdate: () => {
      confirmedAppExit = true;
    },
  });

  registerIpcHandlers(updater);

  if (app.isPackaged) {
    setTimeout(() => {
      void updater.checkForUpdates({ silent: true });
    }, 5000);
  }

  const cliFiles = extractFilePathsFromArgv(process.argv, process.cwd(), __filename);
  for (const file of cliFiles) {
    if (!startupQueue.includes(file)) startupQueue.push(file);
  }

  if (startupQueue.length === 0) {
    createAppWindow();
  } else {
    const initial = startupQueue.splice(0, startupQueue.length);
    for (const filePath of initial) {
      createAppWindow([filePath]);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createAppWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
