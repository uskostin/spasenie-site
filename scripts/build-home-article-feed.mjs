import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const schedulePath = path.join(root, '.seo-factory', 'schedule.csv');
const outputPath = path.join(root, 'home-article-feed.js');
const includePath = process.argv.find(arg => arg.startsWith('--include='))?.slice('--include='.length);

function parseCsv(input) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell); cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [headers, ...data] = rows;
  return data.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function indexCards(html, base) {
  const cards = new Map();
  const pattern = /<a class="article-card" href="([^"]+)"><h2>([^<]+)<\/h2><p>([^<]+)<\/p><\/a>/g;
  for (const match of html.matchAll(pattern)) {
    if (match[1].startsWith(base)) cards.set(match[1], { title: match[2], lead: match[3] });
  }
  return cards;
}

const rows = parseCsv(fs.readFileSync(schedulePath, 'utf8'));
const ruCards = indexCards(fs.readFileSync(path.join(root, 'stati/index.html'), 'utf8'), '/stati/');
const enCards = indexCards(fs.readFileSync(path.join(root, 'en/articles/index.html'), 'utf8'), '/en/articles/');
const published = rows
  .filter(row => row.channel === 'blog' && (row.status === 'published' || row.asset_path === includePath) && /^\d{4}-\d{2}-\d{2}$/.test(row.date))
  .sort((a, b) => b.date.localeCompare(a.date));
const feed = [];

for (const row of published) {
  const match = /^stati\/([^/]+)\/index\.html$/.exec(row.asset_path);
  if (!match) continue;
  const ruUrl = `/stati/${match[1]}/`;
  const ruCard = ruCards.get(ruUrl);
  if (!ruCard) continue;
  const article = fs.readFileSync(path.join(root, row.asset_path), 'utf8');
  const enUrl = article.match(/<link rel="alternate" hreflang="en" href="https:\/\/orlandorussianchurch\.com(\/en\/articles\/[^\"]+)"/)?.[1];
  const enCard = enCards.get(enUrl);
  if (!enUrl || !enCard) continue;
  feed.push({ date: row.date, ruUrl, enUrl, ruTitle: ruCard.title, enTitle: enCard.title, ruLead: ruCard.lead, enLead: enCard.lead });
  if (feed.length === 2) break;
}

if (feed.length < 2) throw new Error('Expected two published bilingual articles in both indexes');
fs.writeFileSync(outputPath, `// Generated from .seo-factory/schedule.csv and the RU/EN article indexes.\nwindow.HOME_ARTICLE_FEED = ${JSON.stringify(feed, null, 2)};\n`);
console.log(`Updated ${outputPath} with ${feed.length} published articles`);
