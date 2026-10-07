import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Only published sitemap URLs are considered. The private schedule supplies
// publication dates; Git's first-add date is a fallback for older pages.
const root = path.resolve(import.meta.dirname, '..');
const sitemapPath = path.join(root, 'sitemap.xml');
const schedulePath = path.join(root, '.seo-factory/schedule.csv');
const includePath = process.argv.find(arg => arg.startsWith('--include='))?.slice('--include='.length);
const origin = 'https://orlandorussianchurch.com';
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

if (includePath && !/^stati\/[a-z0-9-]+\/index\.html$/.test(includePath)) {
  throw new Error('The --include path must identify one Russian article HTML file');
}

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

const scheduled = new Map();
if (fs.existsSync(schedulePath)) {
  for (const row of parseCsv(fs.readFileSync(schedulePath, 'utf8'))) {
    if ((row.status === 'published' || row.asset_path === includePath) && isoDate.test(row.date)
        && /^stati\/[a-z0-9-]+\/index\.html$/.test(row.asset_path)) {
      scheduled.set(`/${row.asset_path.replace(/index\.html$/, '')}`, row.date);
    }
  }
}

function gitDate(file, first = false) {
  const relative = path.relative(root, file);
  try {
    const args = ['log', '--format=%as'];
    if (first) args.push('--diff-filter=A');
    else args.push('-1');
    args.push('--', relative);
    const dates = execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    return first ? dates.at(-1) : dates[0];
  } catch { return undefined; }
}

function fileForUrl(url) {
  const parsed = new URL(url);
  if (parsed.origin !== origin) throw new Error(`Unexpected sitemap origin: ${url}`);
  const relative = parsed.pathname === '/' || parsed.pathname === '/ru/'
    ? 'index.html'
    : `${parsed.pathname.slice(1)}index.html`;
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw new Error(`Sitemap URL has no local HTML: ${url}`);
  return file;
}

const sitemap = fs.readFileSync(sitemapPath, 'utf8');
const urls = [...sitemap.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>[^<]+<\/lastmod>)?/g)].map(match => match[1]);
if (urls.length < 2) throw new Error('No sitemap URLs found');
const lastmodByUrl = new Map();
let articlesUpdated = 0;
const includedArticleDate = includePath
  ? scheduled.get(`/${includePath.replace(/index\.html$/, '')}`)
  : undefined;

for (const url of urls) {
  const file = fileForUrl(url);
  const pathname = new URL(url).pathname;
  let lastmod = gitDate(file);
  if (pathname === '/' || pathname === '/ru/') {
    lastmod = [lastmod, gitDate(path.join(root, 'home-article-feed.js'))].filter(Boolean).sort().at(-1);
  }
  // During the publication commit, Git has not yet recorded the fresh cards.
  // Use only the explicitly selected article's scheduled date for those lists.
  if (includedArticleDate && ['/', '/ru/', '/stati/', '/en/articles/'].includes(pathname)) {
    lastmod = [lastmod, includedArticleDate].filter(Boolean).sort().at(-1);
  }

  if (/^\/(?:stati|en\/articles)\/[^/]+\/$/.test(pathname)) {
    const html = fs.readFileSync(file, 'utf8');
    const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map(match => ({ match, data: JSON.parse(match[1]) }))
      .find(item => ['Article', 'NewsArticle', 'BlogPosting'].includes(item.data['@type']));
    if (jsonLd) {
      const ruUrl = pathname.startsWith('/stati/') ? pathname
        : html.match(/<link rel="alternate" hreflang="ru" href="https:\/\/orlandorussianchurch\.com(\/stati\/[^\"]+)"/)?.[1];
      const published = scheduled.get(ruUrl) || jsonLd.data.datePublished || gitDate(file, true);
      if (!published || !isoDate.test(published)) throw new Error(`Unknown publication date: ${url}`);
      const modified = jsonLd.data.dateModified || [published, lastmod].filter(Boolean).sort().at(-1);
      jsonLd.data.datePublished = published;
      jsonLd.data.dateModified = modified;
      const replacement = `<script type="application/ld+json">${JSON.stringify(jsonLd.data)}</script>`;
      const updatedHtml = html.replace(jsonLd.match[0], replacement);
      if (updatedHtml !== html) {
        fs.writeFileSync(file, updatedHtml);
        articlesUpdated++;
      }
      lastmod = modified;
    }
  }

  if (!lastmod || !isoDate.test(lastmod)) throw new Error(`Unknown last modification date: ${url}`);
  lastmodByUrl.set(url, lastmod);
}

const updatedSitemap = sitemap.replace(/<url><loc>([^<]+)<\/loc>(?:<lastmod>[^<]+<\/lastmod>)?/g,
  (entry, url) => `<url><loc>${url}</loc><lastmod>${lastmodByUrl.get(url)}</lastmod>`);
if (updatedSitemap !== sitemap) fs.writeFileSync(sitemapPath, updatedSitemap);
console.log(`Updated metadata in ${articlesUpdated} articles and lastmod for ${urls.length} sitemap URLs`);
