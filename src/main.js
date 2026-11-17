const { app, BrowserWindow, ipcMain, screen, dialog, Menu, shell } = require('electron');
const obs = require('./obs');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { pathToFileURL } = require('url');

const icon = path.join(__dirname, '..', 'build', 'icon.png');
let control = null;
let projection = null;
let share = null; // fenêtre « Partage » pour Teams, Meet, Zoom…
let lastState = { blank: true };
let settingsFile;
let assetVer = 1; // change quand le fond ou le logo changent (évite de recharger les images à chaque verset)
let settings = {
  version: 'lsg', bg: 'nuit', customImage: null, dim: 0.35, fontSize: 9, displayId: null,
  logo: null, logoSize: 12,
};

function loadSettings() {
  settingsFile = path.join(app.getPath('userData'), 'settings.json');
  try { settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) }; } catch {}
}
const saveSettings = () => { try { fs.writeFileSync(settingsFile, JSON.stringify(settings)); } catch {} };

function bgPath() {
  if (settings.bg === 'custom' && settings.customImage && fs.existsSync(settings.customImage)) return settings.customImage;
  const id = settings.bg === 'custom' ? 'nuit' : settings.bg;
  return path.join(__dirname, 'backgrounds', id + '.svg');
}
const logoPath = () => (settings.logo && fs.existsSync(settings.logo) ? settings.logo : null);

function fullState() {
  return {
    ...lastState, bgUrl: pathToFileURL(bgPath()).href, dim: settings.dim, fontSize: settings.fontSize,
    logoUrl: logoPath() ? pathToFileURL(logoPath()).href : null, logoSize: settings.logoSize,
  };
}
function liveState() {
  return {
    ...lastState, bgUrl: `/asset/bg?v=${assetVer}`, dim: settings.dim, fontSize: settings.fontSize,
    logoUrl: logoPath() ? `/asset/logo?v=${assetVer}` : null, logoSize: settings.logoSize,
  };
}

// ---------- Serveur local pour OBS / vMix / Streamlabs (source « Navigateur ») ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.bmp': 'image/bmp',
};
const STATIC = {
  '/': 'live.html', '/live.html': 'live.html', '/live.js': 'live.js',
  '/projection.js': 'projection.js', '/projection.css': 'projection.css',
};
const sseClients = new Set();
let livePort = null;

function sendFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

function handleLive(req, res) {
  const url = req.url.split('?')[0];
  if (STATIC[url]) return sendFile(res, path.join(__dirname, STATIC[url]));
  if (url === '/asset/bg') return sendFile(res, bgPath());
  if (url === '/asset/logo') { const l = logoPath(); if (l) return sendFile(res, l); res.writeHead(404); return res.end(); }
  if (url === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(liveState())}\n\n`);
    sseClients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clearInterval(ping); sseClients.delete(res); });
    return;
  }
  res.writeHead(404);
  res.end();
}

function startLiveServer() {
  return new Promise((resolve) => {
    const tryPort = (port, left) => {
      const server = http.createServer(handleLive);
      server.once('error', (e) => {
        if (e.code === 'EADDRINUSE' && left > 0) tryPort(port + 1, left - 1); else resolve(null);
      });
      server.listen(port, '127.0.0.1', () => { livePort = port; resolve(port); });
    };
    tryPort(5757, 10);
  });
}

function pushState() {
  for (const w of [projection, share]) if (w && !w.isDestroyed()) w.webContents.send('state', fullState());
  const data = `data: ${JSON.stringify(liveState())}\n\n`;
  for (const c of sseClients) c.write(data);
}

function pickDisplay() {
  const all = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  // Avec un projecteur branché, la projection s'ouvre dessus ; sinon elle s'ouvre en fenêtre séparée.
  return all.find((d) => d.id !== primary.id) || null;
}

function status() {
  const open = !!(projection && !projection.isDestroyed());
  control?.webContents.send('projection:status', { open, fullscreen: open && projection.isFullScreen() });
}

function openProjection() {
  if (projection && !projection.isDestroyed()) { projection.focus(); return; }
  const ext = pickDisplay();
  const b = (ext || screen.getPrimaryDisplay()).bounds;
  projection = new BrowserWindow({
    ...(ext ? { x: b.x, y: b.y, width: b.width, height: b.height, fullscreen: true }
            : { width: 960, height: 540, x: b.x + 60, y: b.y + 60 }),
    title: 'GetVerse - Projection', icon, backgroundColor: '#000', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false },
  });
  projection.loadFile(path.join(__dirname, 'projection.html'));
  // Échap quitte le plein écran quand la fenêtre de projection est active
  projection.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape' && projection.isFullScreen()) {
      e.preventDefault();
      projection.setFullScreen(false);
    }
  });
  projection.on('enter-full-screen', status);
  projection.on('leave-full-screen', status);
  projection.on('closed', () => { projection = null; status(); });
  status();
}

/** Fenêtre propre (16:9, sans commandes) à partager dans Teams, Meet, Zoom… */
function openShare() {
  if (share && !share.isDestroyed()) { share.show(); share.focus(); return; }
  share = new BrowserWindow({
    width: 1280, height: 720, title: 'GetVerse - Partage', icon, backgroundColor: '#000', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false },
  });
  share.loadFile(path.join(__dirname, 'projection.html'));
  // Garde le nom « GetVerse - Partage » (la page voudrait le renommer en « Projection »)
  share.on('page-title-updated', (e) => e.preventDefault());
  share.on('closed', () => { share = null; });
}

const MEETING_APPS = {
  teams: { url: 'msteams:', fallback: 'https://teams.microsoft.com/' },
  meet: { url: 'https://meet.google.com/' },
  zoom: { url: 'zoommtg://zoom.us/', fallback: 'https://zoom.us/' },
};

async function openMeetingApp(kind) {
  const a = MEETING_APPS[kind];
  if (!a) return;
  try { await shell.openExternal(a.url); }
  catch { if (a.fallback) await shell.openExternal(a.fallback); }
}

function createControl() {
  control = new BrowserWindow({
    width: 1180, height: 760, minWidth: 900, minHeight: 600, title: 'GetVerse', icon,
    backgroundColor: '#12151c', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false },
  });
  control.loadFile(path.join(__dirname, 'control.html'));
  control.on('closed', () => {
    control = null;
    if (projection && !projection.isDestroyed()) projection.close();
    if (share && !share.isDestroyed()) share.close();
    app.quit();
  });
}

async function pickImageFile(title) {
  const r = await dialog.showOpenDialog(control, {
    title, properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }],
  });
  return r.canceled ? null : r.filePaths[0] || null;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  loadSettings();
  const livePromise = startLiveServer();
  createControl();

  ipcMain.handle('settings:get', () => settings);
  ipcMain.handle('settings:set', (_e, patch) => {
    settings = { ...settings, ...patch };
    if ('bg' in patch || 'customImage' in patch || 'logo' in patch) assetVer++;
    saveSettings();
    pushState();
    return settings;
  });
  ipcMain.handle('live:info', async () => ({ port: await livePromise }));
  // « Lancer avec » : kind = obs | obs-cam | teams | meet | zoom | other
  ipcMain.handle('launch:start', async (_e, kind, opts = {}) => {
    if (kind === 'obs' || kind === 'obs-cam') {
      const port = await livePromise;
      if (!port) return { ok: false, message: "Le serveur d'affichage n'a pas pu démarrer." };
      return obs.launch({
        mode: opts.mode, livePort: port, virtualCam: kind === 'obs-cam',
        onProgress: (t) => control?.webContents.send('launch:progress', t),
      });
    }
    openShare();
    await openMeetingApp(kind);
    return { ok: true, share: true };
  });
  ipcMain.handle('launch:remove', () => obs.remove());
  ipcMain.handle('launch:open-url', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
  ipcMain.on('projection:state', (_e, s) => { lastState = s; pushState(); });
  ipcMain.on('projection:ready', pushState);
  ipcMain.handle('projection:toggle', (_e, open) => {
    if (open) openProjection();
    else if (projection && !projection.isDestroyed()) projection.close();
  });
  ipcMain.handle('projection:fullscreen', () => {
    if (projection && !projection.isDestroyed()) projection.setFullScreen(!projection.isFullScreen());
  });
  ipcMain.handle('image:pick', async () => {
    const f = await pickImageFile('Choisir une image de fond');
    if (!f) return null;
    settings = { ...settings, bg: 'custom', customImage: f };
    assetVer++;
    saveSettings();
    pushState();
    return settings;
  });
  ipcMain.handle('logo:pick', async () => {
    const f = await pickImageFile("Choisir le logo de l'église");
    if (!f) return null;
    settings = { ...settings, logo: f };
    assetVer++;
    saveSettings();
    pushState();
    return settings;
  });
  app.on('activate', () => { if (!control) createControl(); });
});
app.on('window-all-closed', () => app.quit());
