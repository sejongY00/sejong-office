const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const GITHUB_OWNER = 'sejongY00';
const GITHUB_REPO = 'sejong-office';
const GITHUB_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const GITHUB_RELEASES_PAGE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

function parseSemver(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^v/i, '');
  const [corePart, prePart = ''] = cleaned.split('-', 2);
  const parts = corePart.split('.').map((n) => Number.parseInt(n, 10));
  if (parts.length < 1 || parts.some((n) => Number.isNaN(n))) {
    return null;
  }
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
    prerelease: prePart,
  };
}

/**
 * Compare two semver strings (with or without leading `v`).
 * Returns `1` if `a > b`, `-1` if `a < b`, `0` if equal.
 */
function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1;
  if (pa.prerelease === pb.prerelease) return 0;
  if (!pa.prerelease) return 1;
  if (!pb.prerelease) return -1;
  return pa.prerelease > pb.prerelease ? 1 : -1;
}

/**
 * Pick the best installer asset from a GitHub Release `assets` array for the current OS & arch.
 */
function selectReleaseAsset(assets, platform = process.platform, arch = process.arch) {
  if (!Array.isArray(assets)) return null;
  const valid = assets.filter(
    (item) =>
      item &&
      typeof item.name === 'string' &&
      typeof item.browser_download_url === 'string' &&
      !item.name.includes('__uninstaller') &&
      !item.name.endsWith('.blockmap'),
  );

  if (platform === 'darwin') {
    const normalizedArch = arch === 'arm64' ? 'arm64' : 'x64';
    return (
      valid.find((a) => a.name.endsWith(`-mac-${normalizedArch}.dmg`)) ||
      valid.find((a) => a.name.endsWith('.dmg') && a.name.includes(normalizedArch)) ||
      valid.find((a) => a.name.endsWith(`-mac-${normalizedArch}.zip`)) ||
      valid.find((a) => a.name.endsWith('.dmg')) ||
      null
    );
  }

  if (platform === 'win32') {
    return (
      valid.find((a) => a.name.endsWith('-win-x64.exe')) ||
      valid.find((a) => a.name.endsWith('.exe')) ||
      null
    );
  }

  return null;
}

/**
 * Hybrid desktop updater (zero custom backend — backed solely by GitHub Releases):
 * - Packaged Windows: uses `electron-updater` for blockmap delta auto-download & auto-install.
 * - macOS (unsigned) & dev mode: checks GitHub Releases API, downloads the matching `.dmg`/`.exe`
 *   with live progress, and opens it directly for installation.
 */
function createDesktopUpdater({
  app,
  BrowserWindow,
  net,
  shell,
  autoUpdater = null,
  onBeforeQuitForUpdate = null,
  platform = process.platform,
  arch = process.arch,
}) {
  const currentVersion = typeof app.getVersion === 'function' ? app.getVersion() : '0.0.0';
  const useElectronUpdater = Boolean(
    app.isPackaged && platform === 'win32' && autoUpdater,
  );
  const mode = useElectronUpdater ? 'auto' : 'manual-dmg';

  let state = {
    status: 'idle',
    currentVersion,
    mode,
    silent: true,
  };
  let activeSilent = true;
  let busy = false;

  function broadcastState(patch) {
    state = { ...state, ...patch, currentVersion, mode };
    if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('sejong:update-state', state);
        }
      }
    }
    return state;
  }

  if (useElectronUpdater) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;

    autoUpdater.on('checking-for-update', () => {
      broadcastState({ status: 'checking', silent: activeSilent, message: undefined });
    });

    autoUpdater.on('update-available', (info) => {
      busy = false;
      const latestVersion = String(info?.version || '').replace(/^v/i, '');
      broadcastState({
        status: 'available',
        latestVersion,
        releaseUrl: latestVersion
          ? `${GITHUB_RELEASES_PAGE_URL}/tag/v${latestVersion}`
          : GITHUB_RELEASES_PAGE_URL,
        silent: false,
        message: undefined,
      });
    });

    autoUpdater.on('update-not-available', () => {
      busy = false;
      broadcastState({
        status: 'not-available',
        silent: activeSilent,
        message: undefined,
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.max(0, Math.min(100, Math.round(Number(progress?.percent) || 0)));
      broadcastState({
        status: 'downloading',
        percent,
        silent: false,
        message: undefined,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      busy = false;
      const latestVersion = String(info?.version || state.latestVersion || '').replace(/^v/i, '');
      broadcastState({
        status: 'downloaded',
        latestVersion,
        percent: 100,
        silent: false,
        message: undefined,
      });
    });

    autoUpdater.on('error', (err) => {
      busy = false;
      if (activeSilent) {
        broadcastState({ status: 'idle', silent: true, message: undefined });
        return;
      }
      broadcastState({
        status: 'error',
        silent: false,
        message:
          err && err.message
            ? '업데이트 서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.'
            : '업데이트 확인 중 오류가 발생했습니다.',
      });
    });
  }

  async function checkViaGitHubApi(silent) {
    broadcastState({ status: 'checking', silent, message: undefined });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await net.fetch(GITHUB_LATEST_RELEASE_URL, {
        bypassCustomProtocolHandlers: true,
        signal: controller.signal,
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `Sejong-Office/${currentVersion}`,
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const release = await res.json();
      const latestTag = String(release?.tag_name || '').trim();
      const latestVersion = latestTag.replace(/^v/i, '');
      const releaseUrl = String(release?.html_url || GITHUB_RELEASES_PAGE_URL);

      if (latestVersion && compareSemver(latestVersion, currentVersion) > 0) {
        const asset = selectReleaseAsset(release?.assets, platform, arch);
        return broadcastState({
          status: 'available',
          latestVersion,
          assetName: asset?.name,
          downloadUrl: asset?.browser_download_url,
          releaseUrl,
          silent: false,
          message: undefined,
        });
      }

      return broadcastState({
        status: 'not-available',
        latestVersion: latestVersion || currentVersion,
        releaseUrl,
        silent,
        message: undefined,
      });
    } catch {
      if (silent) {
        return broadcastState({ status: 'idle', silent: true, message: undefined });
      }
      return broadcastState({
        status: 'error',
        silent: false,
        message: '오프라인 상태이거나 업데이트 서버에 연결할 수 없습니다.',
      });
    } finally {
      clearTimeout(timer);
      busy = false;
    }
  }

  async function checkForUpdates({ silent = false } = {}) {
    if (busy || state.status === 'downloading') return state;
    busy = true;
    activeSilent = Boolean(silent);

    if (useElectronUpdater) {
      try {
        await autoUpdater.checkForUpdates();
      } catch {
        busy = false;
        if (activeSilent) {
          broadcastState({ status: 'idle', silent: true, message: undefined });
        } else {
          broadcastState({
            status: 'error',
            silent: false,
            message: '오프라인 상태이거나 업데이트 서버에 연결할 수 없습니다.',
          });
        }
      }
      return state;
    }

    return checkViaGitHubApi(activeSilent);
  }

  async function downloadUpdate() {
    if (state.status !== 'available') return state;
    activeSilent = false;

    if (useElectronUpdater) {
      broadcastState({ status: 'downloading', percent: 0, silent: false, message: undefined });
      try {
        await autoUpdater.downloadUpdate();
      } catch {
        broadcastState({
          status: 'error',
          silent: false,
          message: '업데이트 파일을 내려받지 못했습니다. 네트워크를 확인해 주세요.',
        });
      }
      return state;
    }

    if (!state.downloadUrl) {
      if (state.releaseUrl && shell?.openExternal) {
        await shell.openExternal(state.releaseUrl);
      }
      return state;
    }

    broadcastState({ status: 'downloading', percent: 0, silent: false, message: undefined });
    try {
      const res = await net.fetch(state.downloadUrl, {
        bypassCustomProtocolHandlers: true,
        headers: { 'User-Agent': `Sejong-Office/${currentVersion}` },
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      const total = Number.parseInt(res.headers.get('content-length') || '0', 10) || 0;
      const downloadsDir = app.getPath('downloads');
      const fileName =
        state.assetName ||
        path.basename(new URL(state.downloadUrl).pathname) ||
        `Sejong-Office-${state.latestVersion}.dmg`;
      const targetPath = path.join(downloadsDir, fileName);
      const tempPath = `${targetPath}.download`;

      await fsp.mkdir(downloadsDir, { recursive: true });
      const fileStream = fs.createWriteStream(tempPath);
      const reader = res.body.getReader();
      let received = 0;
      let lastReported = -1;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.byteLength > 0) {
            received += value.byteLength;
            await new Promise((resolve, reject) => {
              fileStream.write(Buffer.from(value), (err) => (err ? reject(err) : resolve()));
            });
            if (total > 0) {
              const pct = Math.min(99, Math.floor((received / total) * 100));
              if (pct !== lastReported) {
                lastReported = pct;
                broadcastState({ status: 'downloading', percent: pct, silent: false });
              }
            }
          }
        }
        await new Promise((resolve, reject) => {
          fileStream.end((err) => (err ? reject(err) : resolve()));
        });
        await fsp.rename(tempPath, targetPath);
      } catch (writeErr) {
        fileStream.destroy();
        await fsp.rm(tempPath, { force: true }).catch(() => {});
        throw writeErr;
      }

      broadcastState({
        status: 'downloaded',
        percent: 100,
        downloadedPath: targetPath,
        silent: false,
        message: undefined,
      });

      if (shell && typeof shell.openPath === 'function') {
        await shell.openPath(targetPath);
      }
      return state;
    } catch {
      return broadcastState({
        status: 'error',
        silent: false,
        message: '설치 파일을 내려받지 못했습니다. 릴리즈 페이지에서 직접 받을 수 있습니다.',
      });
    }
  }

  async function installUpdate() {
    if (useElectronUpdater && state.status === 'downloaded') {
      if (typeof onBeforeQuitForUpdate === 'function') {
        onBeforeQuitForUpdate();
      }
      autoUpdater.quitAndInstall(false, true);
      return true;
    }

    if (state.downloadedPath && shell && typeof shell.openPath === 'function') {
      await shell.openPath(state.downloadedPath);
      return true;
    }

    if (state.releaseUrl && shell && typeof shell.openExternal === 'function') {
      await shell.openExternal(state.releaseUrl);
      return true;
    }

    return false;
  }

  function getState() {
    return state;
  }

  return {
    checkForUpdates,
    downloadUpdate,
    getState,
    installUpdate,
  };
}

module.exports = {
  GITHUB_LATEST_RELEASE_URL,
  GITHUB_RELEASES_PAGE_URL,
  compareSemver,
  createDesktopUpdater,
  selectReleaseAsset,
};
