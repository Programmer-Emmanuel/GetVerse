const $ = (id) => document.getElementById(id);
const q = $('q'), ghost = $('ghost'), sugg = $('sugg'), hint = $('hint');
const VERSIONS = { lsg: 'LSG', bds: 'BDS' };
const bibles = {};
let settings = {};
let version = 'lsg';
let sel = 0;                 // suggestion sélectionnée
let target = null;           // verset prêt à être projeté (aperçu)
let projected = null;        // verset actuellement à l'écran
let blank = false;
let justProjected = false;
let projOpen = false;
let history = [];

const bible = () => bibles[version] || (bibles[version] = window.api.loadBible(version));
const bookById = (id) => BOOKS[id - 1];
const chapters = (b) => bible()[b.id];
const nChapters = (b) => Object.keys(chapters(b)).length;

// ---------- Analyse de la saisie ----------
function parse(raw) {
  const m = raw.match(/^\s*([1-3]?\s*[^\d:]*)([\s\S]*)$/);
  const bookQ = m[1].trim();
  const r = /^\s*(\d+)?(\s*[:.,;vV]\s*|\s+)?(\d+)?(?:\s*[-–]\s*(\d+))?/.exec(m[2]);
  return { bookQ, ch: r[1] ? +r[1] : undefined, hasSep: !!r[2], v1: r[3] ? +r[3] : undefined, v2: r[4] ? +r[4] : undefined };
}

let suggestions = [];
let lastQ = null;

function analyse() {
  const p = parse(q.value);
  if (p.bookQ !== lastQ) { sel = 0; lastQ = p.bookQ; }
  suggestions = p.bookQ ? matchBooks(p.bookQ) : [];
  let book = suggestions[sel] || null;
  let { ch, v1, v2 } = p;

  // Saisie sans livre : on reste dans le livre en cours ("5" = verset 5, "2:5" = chapitre 2 verset 5)
  if (!p.bookQ && projected) {
    book = bookById(projected.book);
    if (ch !== undefined && !p.hasSep && v1 === undefined) { v1 = ch; ch = projected.ch; }
  }
  return { p, book, ch, v1, v2 };
}

function resolve(a) {
  const { book, ch } = a;
  let { v1, v2 } = a;
  if (!book) return { err: a.p.bookQ ? 'Livre introuvable' : null };
  if (ch === undefined) return { info: `${book.name} · ${nChapters(book)} chapitres. Tab pour choisir le chapitre.` };
  const chap = chapters(book)[ch];
  if (!chap) return { err: `${book.name} n'a que ${nChapters(book)} chapitres.` };
  if (v1 === undefined) v1 = 1;
  if (v1 < 1 || v1 > chap.length) return { err: `${book.name} ${ch} n'a que ${chap.length} versets.` };
  if (v2 !== undefined) v2 = Math.min(Math.max(v2, v1), chap.length); else v2 = v1;
  return { target: { book: book.id, ch, v1, v2 }, info: a.v1 === undefined ? `${chap.length} versets dans ce chapitre.` : '' };
}

// ---------- Affichage ----------
const refOf = (t) => {
  const b = bookById(t.book);
  return `${b.name} ${t.ch}:${t.v1}${t.v2 > t.v1 ? '-' + t.v2 : ''}`;
};
const versesOf = (t) => {
  const chap = chapters(bookById(t.book))[t.ch];
  const out = [];
  for (let v = t.v1; v <= t.v2; v++) out.push([v, chap[v - 1]]);
  return out;
};
function fillBody(el, t) {
  el.innerHTML = '';
  const vs = versesOf(t);
  vs.forEach(([n, txt]) => {
    if (vs.length > 1) { const s = document.createElement('sup'); s.textContent = n; el.appendChild(s); }
    el.appendChild(document.createTextNode(txt + ' '));
  });
}

function refresh() {
  const a = analyse();
  const res = resolve(a);
  target = res.target || null;

  // suggestions (seulement pendant la saisie du livre)
  const showSugg = a.p.bookQ && a.ch === undefined && suggestions.length > 0;
  sugg.style.display = showSugg ? 'block' : 'none';
  sugg.innerHTML = '';
  if (showSugg) suggestions.forEach((b, i) => {
    const d = document.createElement('div');
    d.className = i === sel ? 'sel' : '';
    d.innerHTML = `<b></b><span>${nChapters(b)} chap.</span>`;
    d.firstChild.textContent = b.name;
    d.onmousedown = (e) => { e.preventDefault(); sel = i; acceptBook(); };
    sugg.appendChild(d);
  });

  // texte fantôme (complétion en ligne)
  const s0 = suggestions[sel];
  let g = '';
  if (s0 && a.ch === undefined && a.p.bookQ && norm(s0.name).startsWith(norm(a.p.bookQ)) && !/\s/.test(q.value.trim()) && a.p.bookQ.length < s0.name.length) {
    g = `${escapeHtml(q.value)}<b>${escapeHtml(s0.name.slice(a.p.bookQ.length))}</b>`;
  }
  ghost.innerHTML = g;

  q.classList.toggle('bad', !!res.err);
  hint.className = res.err ? 'err' : '';
  hint.textContent = res.err || res.info || '';

  const pv = $('preview');
  if (target) {
    pv.classList.remove('empty');
    $('pref').textContent = refOf(target) + ' · ' + VERSIONS[version];
    fillBody($('pbody'), target);
  } else {
    pv.classList.add('empty');
    $('pref').textContent = '';
    $('pbody').textContent = 'Tapez un livre, un chapitre et un verset.';
  }
}
const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function refreshLive() {
  const lv = $('live'), badge = $('badge');
  if (!projected) { lv.classList.add('empty'); $('lref').textContent = '-'; $('lbody').textContent = 'Rien n\'est affiché.'; badge.textContent = 'Rien'; badge.className = 'live-badge'; return; }
  lv.classList.remove('empty');
  $('lref').textContent = refOf(projected) + ' · ' + VERSIONS[version];
  fillBody($('lbody'), projected);
  badge.textContent = blank ? 'Écran vide' : 'À l\'écran';
  badge.className = 'live-badge ' + (blank ? 'blank' : 'on');
  $('blank').classList.toggle('on', blank);
}

// ---------- Projection ----------
function send() {
  if (!projected || blank) { window.api.send({ blank: true }); return; }
  window.api.send({
    blank: false, ref: refOf(projected), verses: versesOf(projected), version, versionLabel: VERSIONS[version],
  });
}

function project(t) {
  projected = { ...t };
  blank = false;
  history = [refOf(t), ...history.filter((h) => h !== refOf(t))].slice(0, 12);
  histMap[refOf(t)] = { ...t };
  send();
  refreshLive();
  renderHistory();
  if (!projOpen) window.api.toggleProjection(true);
}
const histMap = {};
function renderHistory() {
  $('histPanel').style.display = history.length ? '' : 'none';
  const h = $('history');
  h.innerHTML = '';
  history.forEach((r) => {
    const b = document.createElement('button');
    b.textContent = r;
    b.onclick = () => { project(histMap[r]); setInput(histMap[r]); };
    h.appendChild(b);
  });
}

function setInput(t) {
  q.value = refOf(t);
  q.focus();
  q.select();
  justProjected = true;
  lastQ = null;
  refresh();
}

function step(dir) {
  if (!projected) return;
  let { book, ch, v1, v2 } = projected;
  let v = dir > 0 ? v2 + 1 : v1 - 1;
  const b = bookById(book);
  if (v > chapters(b)[ch].length) {
    if (chapters(b)[ch + 1]) { ch++; v = 1; }
    else if (book < 66) { book++; ch = 1; v = 1; }
    else return;
  } else if (v < 1) {
    if (ch > 1) { ch--; v = chapters(b)[ch].length; }
    else if (book > 1) { book--; ch = nChapters(bookById(book)); v = chapters(bookById(book))[ch].length; }
    else return;
  }
  const t = { book, ch, v1: v, v2: v };
  project(t);
  setInput(t);
}

function acceptBook() {
  const a = analyse();
  const b = suggestions[sel];
  if (!b) return;
  q.value = b.name + ' ';
  lastQ = null; sel = 0;
  refresh();
}

// Passe à l'étape suivante de la saisie. Retourne false s'il n'y a rien à valider (prêt à projeter).
function advance() {
  const a = analyse();
  if (a.ch === undefined && a.p.bookQ && suggestions[sel]) { acceptBook(); return true; }
  if (a.ch !== undefined && !a.hasSep && a.v1 === undefined && a.book && chapters(a.book)[a.ch]) {
    q.value = `${a.p.bookQ ? a.book.name + ' ' : ''}${a.ch}:`;
    lastQ = null;
    refresh();
    return true;
  }
  return false;
}

q.addEventListener('input', () => { justProjected = false; refresh(); });
q.addEventListener('keydown', (e) => {
  const k = e.key;
  const showingSugg = sugg.style.display === 'block';
  if (k === 'Tab') {
    e.preventDefault();
    advance();
  } else if (k === 'Enter') {
    // Entrée = Tab (livre → chapitre → verset), puis projette quand tout est saisi.
    e.preventDefault();
    if (!advance() && target) { project(target); setInput(target); }
  } else if (showingSugg && (k === 'ArrowDown' || k === 'ArrowUp')) {
    e.preventDefault();
    sel = (sel + (k === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length;
    refresh();
  } else if (k === 'PageDown' || (justProjected && (k === 'ArrowRight' || k === 'ArrowDown'))) {
    e.preventDefault(); step(1);
  } else if (k === 'PageUp' || (justProjected && (k === 'ArrowLeft' || k === 'ArrowUp'))) {
    e.preventDefault(); step(-1);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); toggleBlank(); }
  else if (e.key === 'F2') { e.preventDefault(); setVersion(version === 'lsg' ? 'bds' : 'lsg'); }
  else if (document.activeElement !== q && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement)) {
    if (e.key === 'PageDown') step(1); else if (e.key === 'PageUp') step(-1);
    else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) q.focus();
  }
});

function toggleBlank() {
  if (!projected) return;
  blank = !blank;
  send(); refreshLive();
}
$('blank').onclick = () => { toggleBlank(); q.focus(); };
$('next').onclick = () => { step(1); q.focus(); };
$('prev').onclick = () => { step(-1); q.focus(); };

// ---------- Versions ----------
function setVersion(v) {
  version = v;
  window.api.setSettings({ version: v });
  document.querySelectorAll('#versions button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  if (projected) {
    const chap = chapters(bookById(projected.book))[projected.ch];
    if (!chap) projected = null; else { projected.v1 = Math.min(projected.v1, chap.length); projected.v2 = Math.min(projected.v2, chap.length); }
  }
  send(); refreshLive(); refresh();
}
document.querySelectorAll('#versions button').forEach((b) => { b.onclick = () => { setVersion(b.dataset.v); q.focus(); }; });

// ---------- Réglages / projection ----------
const BGS = [['nuit', 'Nuit'], ['aube', 'Aube'], ['ocean', 'Océan'], ['pourpre', 'Pourpre'], ['foret', 'Forêt']];
function renderBgs() {
  const box = $('bgs');
  box.innerHTML = '';
  BGS.forEach(([id, label]) => {
    const b = document.createElement('button');
    b.className = settings.bg === id ? 'on' : '';
    b.innerHTML = `<img src="backgrounds/${id}.svg" alt=""><span>${label}</span>`;
    b.onclick = async () => { settings = await window.api.setSettings({ bg: id }); renderBgs(); q.focus(); };
    box.appendChild(b);
  });
  if (settings.customImage) {
    const wrap = document.createElement('div');
    wrap.className = 'custom';
    const b = document.createElement('button');
    b.className = settings.bg === 'custom' ? 'on' : '';
    b.innerHTML = `<img alt=""><span>Mon image</span>`;
    b.firstChild.src = encodeURI('file:///' + settings.customImage.replace(/\\/g, '/'));
    b.onclick = async () => { settings = await window.api.setSettings({ bg: 'custom' }); renderBgs(); q.focus(); };
    const x = document.createElement('button');
    x.className = 'del';
    x.title = 'Supprimer cette image';
    x.textContent = '×';
    x.onclick = async (e) => {
      e.stopPropagation();
      settings = await window.api.setSettings({ customImage: null, ...(settings.bg === 'custom' ? { bg: 'nuit' } : {}) });
      renderBgs();
      q.focus();
    };
    wrap.append(b, x);
    box.appendChild(wrap);
  }
}
$('pickImg').onclick = async () => { const s = await window.api.pickImage(); if (s) { settings = s; renderBgs(); } q.focus(); };
$('dim').oninput = (e) => { $('dimV').textContent = e.target.value + ' %'; window.api.setSettings({ dim: e.target.value / 100 }); };
$('fsz').oninput = (e) => { $('fsV').textContent = e.target.value; window.api.setSettings({ fontSize: +e.target.value }); };
$('projToggle').onclick = () => { window.api.toggleProjection(!projOpen); q.focus(); };
$('fs').onclick = () => { window.api.toggleFullscreen(); q.focus(); };
$('display').onchange = (e) => window.api.setSettings({ displayId: +e.target.value });

window.api.onProjectionStatus((s) => {
  const wasOpen = projOpen;
  projOpen = s.open;
  $('projToggle').textContent = s.open ? 'Fermer la projection' : 'Ouvrir la projection';
  $('projToggle').className = 'btn' + (s.open ? '' : ' primary');
  $('fs').disabled = !s.open;
  $('fs').textContent = s.fullscreen ? 'Quitter le plein écran' : 'Plein écran';
  if (s.open && !wasOpen) send();
});

(async function init() {
  settings = await window.api.getSettings();
  version = settings.version || 'lsg';
  document.querySelectorAll('#versions button').forEach((b) => b.classList.toggle('on', b.dataset.v === version));
  $('dim').value = Math.round((settings.dim ?? 0.35) * 100); $('dimV').textContent = $('dim').value + ' %';
  $('fsz').value = settings.fontSize ?? 9; $('fsV').textContent = $('fsz').value;
  renderBgs();
  const displays = await window.api.getDisplays();
  if (displays.length > 1) {
    const sel2 = $('display');
    sel2.style.display = '';
    sel2.innerHTML = displays.map((d) => `<option value="${d.id}">${d.label}</option>`).join('');
    if (settings.displayId) sel2.value = settings.displayId;
    else sel2.selectedIndex = displays.length - 1;
  }
  bible();
  refresh(); refreshLive();
  q.focus();
})();
