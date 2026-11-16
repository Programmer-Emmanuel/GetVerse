const { app, BrowserWindow, ipcMain, screen, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const icon = path.join(__dirname, '..', 'build', 'icon.png');
let control = null;
let projection = null;
let lastState = { blank: true };
let settingsFile;
let settings = {
  version: 'lsg', bg: 'nuit', customImage: null, dim: 0.35, fontSize: 9, displayId: null,
};

function loadSettings() {
  settingsFile = path.join(app.getPath('userData'), 'settings.json');
  try { settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) }; } catch {}
}
const saveSettings = () => { try { fs.writeFileSync(settingsFile, JSON.stringify(settings)); } catch {} };

function bgUrl() {
  if (settings.bg === 'custom' && settings.customImage && fs.existsSync(settings.customImage)) {
    return pathToFileURL(settings.customImage).href;
  }
  const id = settings.bg === 'custom' ? 'nuit' : settings.bg;
  return pathToFileURL(path.join(__dirname, 'backgrounds', id + '.svg')).href;
}

function fullState() {
  return { ...lastState, bgUrl: bgUrl(), dim: settings.dim, fontSize: settings.fontSize };
}
const pushState = () => {
  if (projection && !projection.isDestroyed()) projection.webContents.send('state', fullState());
};

function pickDisplay() {
  const all = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  return all.find((d) => d.id === settings.displayId) || all.find((d) => d.id !== primary.id) || null;
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
  projection.on('enter-full-screen', status);
  projection.on('leave-full-screen', status);
  projection.on('closed', () => { projection = null; status(); });
  status();
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
    app.quit();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  loadSettings();
  createControl();

  ipcMain.handle('settings:get', () => settings);
  ipcMain.handle('settings:set', (_e, patch) => {
    settings = { ...settings, ...patch };
    saveSettings();
    pushState();
    if ('displayId' in patch && projection && !projection.isDestroyed()) {
      projection.close();
      openProjection();
    }
    return settings;
  });
  ipcMain.handle('displays:get', () => {
    const primary = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map((d, i) => ({
      id: d.id,
      label: `Écran ${i + 1} (${d.size.width}×${d.size.height})${d.id === primary ? ' - principal' : ''}`,
    }));
  });
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
    const r = await dialog.showOpenDialog(control, {
      title: 'Choisir une image de fond', properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    settings = { ...settings, bg: 'custom', customImage: r.filePaths[0] };
    saveSettings();
    pushState();
    return settings;
  });
  app.on('activate', () => { if (!control) createControl(); });
});
app.on('window-all-closed', () => app.quit());
