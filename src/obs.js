// Intégration à OBS Studio via son serveur WebSocket (obs-websocket 5, intégré à OBS 28+).
// GetVerse ouvre OBS si besoin, active le serveur WebSocket et crée la source d'affichage des versets.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');

const SOURCE_NAME = 'GetVerse';
const sha = (s) => crypto.createHash('sha256').update(s).digest('base64');
const authString = (password, salt, challenge) => sha(sha(password + salt) + challenge);
const err = (code, message) => Object.assign(new Error(message || code), { code });

// ---------- Détection d'OBS ----------
function execP(cmd, args) {
  return new Promise((resolve) => execFile(cmd, args, { windowsHide: true }, (e, out) => resolve(e ? '' : String(out))));
}

async function findObsExe() {
  const candidates = [];
  const reg = await execP('reg', ['query', 'HKLM\\SOFTWARE\\OBS Studio', '/ve']);
  const m = reg.match(/REG_SZ\s+(.+)/);
  if (m) candidates.push(path.join(m[1].trim(), 'bin', '64bit', 'obs64.exe'));
  for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')]) {
    if (base) candidates.push(path.join(base, 'obs-studio', 'bin', '64bit', 'obs64.exe'));
  }
  return candidates.find((c) => fs.existsSync(c)) || null;
}

async function isObsRunning() {
  return /obs64\.exe/i.test(await execP('tasklist', ['/FI', 'IMAGENAME eq obs64.exe', '/NH']));
}

// ---------- Configuration du serveur WebSocket d'OBS ----------
const configFile = () => path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'obs-studio', 'plugin_config', 'obs-websocket', 'config.json');

function readConfig() {
  try { return JSON.parse(fs.readFileSync(configFile(), 'utf8')); } catch { return {}; }
}

/** À n'utiliser que si OBS est fermé (OBS réécrit ce fichier en quittant). */
function enableServer() {
  const cfg = readConfig();
  const next = {
    ...cfg,
    auth_required: true,
    first_load: false,
    server_enabled: true,
    server_port: cfg.server_port || 4455,
    server_password: cfg.server_password || crypto.randomBytes(9).toString('base64url'),
  };
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(next, null, 2));
  return next;
}

// ---------- Client WebSocket (protocole obs-websocket 5) ----------
function connect(port, password, timeout = 3000) {
  return new Promise((resolve, reject) => {
    let ws; let settled = false; let n = 0;
    const pending = new Map();
    const fail = (e) => { if (settled) return; settled = true; clearTimeout(timer); try { ws.close(); } catch {} reject(e); };
    const timer = setTimeout(() => fail(err('timeout')), timeout);

    const request = (type, data) => new Promise((res, rej) => {
      const id = String(++n);
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: id, requestData: data || {} } }));
      setTimeout(() => { if (pending.delete(id)) rej(err('timeout')); }, 8000);
    });
    const close = () => { try { ws.close(); } catch {} };

    try { ws = new WebSocket(`ws://127.0.0.1:${port}`); } catch { return fail(err('refused')); }
    ws.onerror = () => fail(err('refused'));
    ws.onclose = (ev) => {
      fail(err(ev.code === 4009 ? 'auth' : 'closed'));
      pending.forEach((p) => p.rej(err('closed')));
    };
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.op === 0) {
        const id = { rpcVersion: 1, eventSubscriptions: 0 };
        if (m.d.authentication) id.authentication = authString(password || '', m.d.authentication.salt, m.d.authentication.challenge);
        ws.send(JSON.stringify({ op: 1, d: id }));
      } else if (m.op === 2 && !settled) {
        settled = true; clearTimeout(timer);
        resolve({ request, close });
      } else if (m.op === 7) {
        const p = pending.get(m.d.requestId);
        if (!p) return;
        pending.delete(m.d.requestId);
        if (m.d.requestStatus.result) p.res(m.d.responseData || {});
        else p.rej(err(m.d.requestStatus.code, m.d.requestStatus.comment));
      }
    };
  });
}

// ---------- Création de la source dans la scène en cours ----------
async function ensureSource(client, url) {
  const { baseWidth, baseHeight } = await client.request('GetVideoSettings');
  const { currentProgramSceneName: scene } = await client.request('GetCurrentProgramScene');
  const settings = { url, width: baseWidth || 1920, height: baseHeight || 1080 };
  try {
    await client.request('CreateInput', { sceneName: scene, inputName: SOURCE_NAME, inputKind: 'browser_source', inputSettings: settings, sceneItemEnabled: true });
  } catch (e) {
    if (e.code !== 601) throw e; // 601 : la source existe déjà -> on la met à jour
    await client.request('SetInputSettings', { inputName: SOURCE_NAME, inputSettings: settings, overlay: true });
    try { await client.request('GetSceneItemId', { sceneName: scene, sourceName: SOURCE_NAME }); }
    catch { await client.request('CreateSceneItem', { sceneName: scene, sourceName: SOURCE_NAME, sceneItemEnabled: true }); }
  }
  return scene;
}

// ---------- Parcours complet « Lancer avec OBS » ----------
async function launch({ mode, livePort, virtualCam, onProgress = () => {} }) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const url = `http://localhost:${livePort}/` + (mode === 'transparent' || mode === 'bandeau' ? `?mode=${mode}` : '');
  let cfg = readConfig();
  let client = null;

  if (await isObsRunning()) {
    if (!cfg.server_enabled) {
      return { ok: false, code: 'ws-disabled', message: "OBS est ouvert, mais sa connexion WebSocket est désactivée. Dans OBS : menu Outils → Paramètres du serveur WebSocket → cochez « Activer le serveur WebSocket », puis recliquez. (Ou fermez OBS : GetVerse l'activera tout seul.)" };
    }
    onProgress('Connexion à OBS…');
    try { client = await connect(cfg.server_port || 4455, cfg.server_password); }
    catch (e) { return { ok: false, code: e.code, message: e.code === 'auth' ? "Mot de passe WebSocket refusé par OBS. Vérifiez-le dans Outils → Paramètres du serveur WebSocket." : "Impossible de se connecter à OBS. Vérifiez que le serveur WebSocket est activé." }; }
  } else {
    const exe = await findObsExe();
    if (!exe) return { ok: false, code: 'not-installed', message: "OBS Studio est introuvable sur cet ordinateur. Installez-le depuis obsproject.com, puis recliquez." };
    onProgress('Préparation d\'OBS…');
    cfg = enableServer();
    onProgress('Ouverture d\'OBS…');
    spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore' }).unref();
    const deadline = Date.now() + 60000;
    while (!client && Date.now() < deadline) {
      await wait(1500);
      try { client = await connect(cfg.server_port, cfg.server_password, 2500); }
      catch (e) { if (e.code === 'auth') return { ok: false, code: 'auth', message: 'Mot de passe WebSocket refusé par OBS.' }; }
      onProgress('Ouverture d\'OBS…');
    }
    if (!client) return { ok: false, code: 'timeout', message: "OBS ne répond pas. Patientez qu'il soit complètement ouvert, puis recliquez." };
  }

  try {
    onProgress('Ajout de l\'affichage dans OBS…');
    const scene = await ensureSource(client, url);
    let cam = false;
    if (virtualCam) {
      try { await client.request('StartVirtualCam'); cam = true; }
      catch (e) { if (e.code === 500 || /already/i.test(e.message)) cam = true; }
    }
    return { ok: true, scene, cam };
  } catch (e) {
    return { ok: false, code: e.code, message: `OBS a refusé la demande (${e.message}).` };
  } finally {
    client.close();
  }
}

async function remove() {
  const cfg = readConfig();
  if (!(await isObsRunning())) return { ok: true };
  try {
    const client = await connect(cfg.server_port || 4455, cfg.server_password);
    try { await client.request('RemoveInput', { inputName: SOURCE_NAME }); } catch {}
    try { await client.request('StopVirtualCam'); } catch {}
    client.close();
    return { ok: true };
  } catch { return { ok: false, message: 'Impossible de joindre OBS.' }; }
}

module.exports = { launch, remove, connect, ensureSource, authString, SOURCE_NAME };
