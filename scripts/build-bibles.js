// Convertit les Bibles sources en un format compact : { "livre": { "chapitre": ["v1","v2",...] } }
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'data');

const BDS_TO_CANON = {10:1,20:2,30:3,40:4,50:5,60:6,70:7,80:8,90:9,100:10,110:11,120:12,130:13,140:14,150:15,160:16,190:17,220:18,230:19,240:20,250:21,260:22,290:23,300:24,310:25,330:26,340:27,350:28,360:29,370:30,380:31,390:32,400:33,410:34,420:35,430:36,440:37,450:38,460:39,470:40,480:41,490:42,500:43,510:44,520:45,530:46,540:47,550:48,560:49,570:50,580:51,590:52,600:53,610:54,620:55,630:56,640:57,650:58,660:59,670:60,680:61,690:62,700:63,710:64,720:65,730:66};

const clean = (s) => s
  .replace(/<f>.*?<\/f>/g, '')      // notes de bas de page [1]
  .replace(/<n>.*?<\/n>/g, '')      // numéros de versets multiples
  .replace(/<[^>]+>/g, '')          // autres balises
  .replace(/¶/g, '')
  .replace(/\s+([,.;:!?»])/g, (m, p) => (p === '»' ? ' »' : m.trimStart() === p && /[;:!?»]/.test(p) ? ' ' + p : p))
  .replace(/\s{2,}/g, ' ')
  .trim();

function put(out, book, ch, v, text) {
  ((out[book] ??= {})[ch] ??= [])[v - 1] = clean(text);
}

const lsg = {};
for (const x of require(path.join(dir, 'segond_1910.json')).verses) put(lsg, x.book, x.chapter, x.verse, x.text);

const bds = {};
for (const x of require(path.join(dir, 'bds_fr.json')).verses) {
  const b = BDS_TO_CANON[x.book_number];
  if (b) put(bds, b, x.chapter, x.verse, x.text);
}

fs.writeFileSync(path.join(dir, 'lsg.json'), JSON.stringify(lsg));
fs.writeFileSync(path.join(dir, 'bds.json'), JSON.stringify(bds));
for (const [n, b] of [['LSG', lsg], ['BDS', bds]]) {
  const holes = Object.values(b).flatMap(c => Object.values(c)).filter(c => Array.from(c).some(v => v === undefined)).length;
  console.log(n, Object.keys(b).length, 'livres, chapitres incomplets:', holes);
}
