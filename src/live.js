// Page « Direct » : reçoit les versets en temps réel depuis l'application, pour une source Navigateur (OBS, vMix…).
// Adresses : /  (avec fond)   /?mode=transparent  (texte seul)   /?mode=bandeau  (bandeau en bas)
const mode = new URLSearchParams(location.search).get('mode');
if (mode === 'transparent' || mode === 'bandeau') document.body.classList.add(mode);
document.documentElement.style.background = 'transparent';
document.body.style.background = 'transparent';

window.api = {
  onState(cb) {
    const es = new EventSource('/events');
    es.onmessage = (e) => cb(JSON.parse(e.data));
  },
  projectionReady() {},
};
