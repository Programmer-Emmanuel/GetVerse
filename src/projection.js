const $ = (id) => document.getElementById(id);
const stage = $('stage'), vtext = $('vtext'), refEl = $('ref'), verse = $('verse');
let current = null;
let state = {};

// Ajuste la taille du texte pour qu'il tienne toujours à l'écran.
function fit() {
  const max = (state.fontSize || 9) * window.innerHeight / 100;
  let lo = 14, hi = max, best = lo;
  const avail = verse.clientHeight;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    vtext.style.fontSize = mid + 'px';
    if (vtext.scrollHeight <= avail && vtext.scrollWidth <= verse.clientWidth + 1) { best = mid; lo = mid; } else hi = mid;
  }
  vtext.style.fontSize = best + 'px';
}

function render(s) {
  state = s;
  $('bg').style.backgroundImage = s.bgUrl ? `url("${s.bgUrl}")` : 'none';
  $('dim').style.opacity = s.dim ?? 0.35;
  const key = s.blank ? 'blank' : JSON.stringify([s.ref, s.verses, s.version]);
  if (key === current) { if (!s.blank) fit(); return; }
  current = key;
  stage.classList.add('hide');
  setTimeout(() => {
    if (!s.blank && s.verses) {
      vtext.innerHTML = '';
      const multi = s.verses.length > 1;
      s.verses.forEach(([n, t]) => {
        const sp = document.createElement('span');
        if (multi) { const sup = document.createElement('sup'); sup.textContent = n; sp.appendChild(sup); }
        sp.appendChild(document.createTextNode(t));
        vtext.appendChild(sp);
      });
      refEl.innerHTML = '';
      refEl.appendChild(document.createTextNode(s.ref));
      const v = document.createElement('small');
      v.textContent = s.versionLabel || '';
      refEl.appendChild(v);
      fit();
      stage.classList.remove('hide');
    }
  }, 250);
}

window.api.onState(render);
window.addEventListener('resize', () => fit());
window.api.projectionReady();
