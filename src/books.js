// Livres de la Bible (numérotation canonique 1-66) avec abréviations françaises courantes.
const B = [
  ['Genèse', 'gn gen ge'], ['Exode', 'ex exo'], ['Lévitique', 'lv lev le'], ['Nombres', 'nb nom'],
  ['Deutéronome', 'dt deut'], ['Josué', 'jos'], ['Juges', 'jg jug'], ['Ruth', 'rt ru'],
  ['1 Samuel', '1s 1sa 1sam'], ['2 Samuel', '2s 2sa 2sam'], ['1 Rois', '1r 1ro'], ['2 Rois', '2r 2ro'],
  ['1 Chroniques', '1ch 1chr'], ['2 Chroniques', '2ch 2chr'], ['Esdras', 'esd'], ['Néhémie', 'ne neh'],
  ['Esther', 'est'], ['Job', 'jb'], ['Psaumes', 'ps psa psaume'], ['Proverbes', 'pr pro prov'],
  ['Ecclésiaste', 'ec ecc eccl'], ['Cantique des cantiques', 'ct cant cantique'], ['Ésaïe', 'es esa isaie is'],
  ['Jérémie', 'jr jer'], ['Lamentations', 'lm lam'], ['Ézéchiel', 'ez eze ezec'], ['Daniel', 'dn dan'],
  ['Osée', 'os'], ['Joël', 'jl joe'], ['Amos', 'am'], ['Abdias', 'ab abd'], ['Jonas', 'jon jna'],
  ['Michée', 'mi mic'], ['Nahum', 'na nah'], ['Habacuc', 'ha hab'], ['Sophonie', 'so sop'],
  ['Aggée', 'ag agg'], ['Zacharie', 'za zac'], ['Malachie', 'ml mal'],
  ['Matthieu', 'mt mat'], ['Marc', 'mc mr'], ['Luc', 'lc lu'], ['Jean', 'jn'], ['Actes', 'ac act'],
  ['Romains', 'rm rom ro'], ['1 Corinthiens', '1co 1cor'], ['2 Corinthiens', '2co 2cor'],
  ['Galates', 'ga gal'], ['Éphésiens', 'ep eph'], ['Philippiens', 'ph phil php'], ['Colossiens', 'col'],
  ['1 Thessaloniciens', '1th 1thes'], ['2 Thessaloniciens', '2th 2thes'], ['1 Timothée', '1ti 1tim'],
  ['2 Timothée', '2ti 2tim'], ['Tite', 'tt tit'], ['Philémon', 'phm phlm'], ['Hébreux', 'he heb'],
  ['Jacques', 'jc jac'], ['1 Pierre', '1p 1pi'], ['2 Pierre', '2p 2pi'], ['1 Jean', '1jn 1j'],
  ['2 Jean', '2jn 2j'], ['3 Jean', '3jn 3j'], ['Jude', 'jud'], ['Apocalypse', 'ap apo'],
];

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s.'’\-]/g, '');

const BOOKS = B.map(([name, aliases], i) => ({
  id: i + 1,
  name,
  key: norm(name),
  aliases: aliases.split(' ').map(norm),
}));

function subsequenceCost(q, s) {
  if (q[0] !== s[0]) return -1;
  let j = 0, gaps = 0;
  for (let i = 0; i < s.length && j < q.length; i++) {
    if (s[i] === q[j]) j++; else if (j > 0) gaps++;
  }
  return j === q.length ? gaps : -1;
}

/** Retourne les livres correspondants à une saisie (fuzzy), meilleur en premier. */
function matchBooks(query, limit = 6) {
  const q = norm(query);
  if (!q) return [];
  const res = [];
  for (const b of BOOKS) {
    let score = 0;
    if (b.aliases.includes(q)) score = 100;
    else if (b.key === q) score = 100;
    else if (b.key.startsWith(q)) score = 90;
    else if (b.aliases.some((a) => a.startsWith(q))) score = 80;
    else {
      const c = subsequenceCost(q, b.key);
      if (c >= 0 && q.length >= 2) score = 50 - Math.min(c, 40);
    }
    if (score) res.push({ book: b, score });
  }
  res.sort((a, b) => b.score - a.score || a.book.id - b.book.id);
  return res.slice(0, limit).map((r) => r.book);
}

if (typeof module !== 'undefined') module.exports = { BOOKS, matchBooks, norm };
