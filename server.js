// Static server for GoDaddy Node.js Hosting. No dependencies.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
// GoDaddy may retain files removed by a later deployment. Keep scheduled
// articles unreachable until their publication commit removes the path here.
const UNPUBLISHED_PATHS = new Set([]);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon"
};
const HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
};

function russianHome(html) {
  return html
    .replace('<html lang="en">', '<html lang="ru">')
    .replace('<body class="lang-en">', '<body class="lang-ru">')
    .replace('aria-label="Menu"', 'aria-label="Меню"')
    .replace('Spasenie Church — Sunday at 1 PM, Thursday at 7 PM', 'Церковь «Спасение» — воскресенье 13:00, четверг 19:00')
    .replace('Russian-Speaking Church in Orlando | Spasenie Church', 'Церковь «Спасение» — русскоязычная церковь в Орландо')
    .replace('Spasenie is a Russian-speaking Christian church in Winter Park, Orlando area. Sunday worship at 1 PM; Thursday Bible study and prayer at 7 PM. 701 Formosa Avenue.', 'Русскоязычная христианская церковь в Winter Park, в районе Орландо. Богослужение в воскресенье в 13:00, изучение Библии и молитва в четверг в 19:00. 701 Formosa Avenue.')
    .replace('<link rel="canonical" href="https://orlandorussianchurch.com/">', '<link rel="canonical" href="https://orlandorussianchurch.com/ru/">')
    .replace('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="ru_RU">')
    .replace('<meta property="og:locale:alternate" content="ru_RU">', '<meta property="og:locale:alternate" content="en_US">')
    .replace('Spasenie Church | Russian-Speaking Church in Orlando', 'Церковь «Спасение» | Русскоязычная церковь в Орландо')
    .replace('Russian-language worship in Winter Park every Sunday at 1 PM, with Bible study and prayer on Thursdays at 7 PM.', 'Русскоязычное богослужение в Winter Park каждое воскресенье в 13:00; изучение Библии и молитва по четвергам в 19:00.')
    .replace('<meta property="og:url" content="https://orlandorussianchurch.com/">', '<meta property="og:url" content="https://orlandorussianchurch.com/ru/">')
    .replace('<section class="wrap" aria-label="Visitor information">', '<section class="wrap" aria-label="Информация для посетителей">')
    .replace('<h1>Russian-speaking church in the Orlando area</h1>', '<h1>Русскоязычная церковь в районе Орландо</h1>')
    .replace('Spasenie Church meets at 701 Formosa Avenue, Winter Park, Florida. Sunday worship begins at 1:00 PM. The Thursday Bible study and prayer meeting begins at 7:00 PM. Services are held primarily in Russian.', 'Церковь «Спасение» собирается по адресу 701 Formosa Avenue, Winter Park, Florida. Воскресное богослужение начинается в 13:00. Изучение Библии и молитва по четвергам начинаются в 19:00. Основной язык встреч — русский.')
    .replace('<a href="/ru/">Русская версия</a> · <a href="/en/articles/">English articles</a>', '<a href="/stati/">Статьи на русском</a> · <a href="/">English homepage</a>')
    .replace(/(["'])img\//g, '$1/img/')
    .replace(/(["'])video\//g, '$1/video/');
}

function send(res, code, body, type, cache) {
  res.writeHead(code, { ...HEADERS, "Content-Type": type, "Cache-Control": cache });
  res.end(body);
}

http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    return send(res, 400, "Bad request", "text/plain; charset=utf-8", "no-store");
  }

  if (pathname === "/index.html") {
    res.writeHead(301, { ...HEADERS, Location: "/" });
    return res.end();
  }

  if (pathname === "/ru") {
    res.writeHead(301, { ...HEADERS, Location: "/ru/" });
    return res.end();
  }

  if (pathname === "/ru/") {
    return fs.readFile(path.join(ROOT, "index.html"), "utf8", (error, html) => {
      if (error) return send(res, 404, "Not found", "text/plain; charset=utf-8", "no-store");
      send(res, 200, russianHome(html), "text/html; charset=utf-8", "public, max-age=600");
    });
  }

  const normalizedPathname = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (UNPUBLISHED_PATHS.has(normalizedPathname)) {
    return send(res, 404, "Not found", "text/plain; charset=utf-8", "no-store");
  }

  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(ROOT, relative);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    return send(res, 404, "Not found", "text/plain; charset=utf-8", "no-store");
  }

  fs.stat(file, (statError, stats) => {
    const target = !statError && stats.isDirectory() ? path.join(file, "index.html") : file;
    fs.readFile(target, (readError, data) => {
      if (readError) {
        return send(res, 404, "Not found", "text/plain; charset=utf-8", "no-store");
      }
      const ext = path.extname(target).toLowerCase();
      const cache = ext === ".html" ? "public, max-age=600" : "public, max-age=31536000, immutable";
      send(res, 200, data, TYPES[ext] || "application/octet-stream", cache);
    });
  });
}).listen(PORT, () => console.log(`spasenie static server on :${PORT}`));
