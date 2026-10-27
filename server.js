// Static server for GoDaddy Node.js Hosting. No dependencies.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
// GoDaddy may retain files removed by a later deployment. Keep scheduled
// articles unreachable until their publication commit removes the path here.
const UNPUBLISHED_PATHS = new Set([]);
// Retired by the owner; retain source files for recovery, but return 410.
const RETIRED_PATHS = new Set(["/stati/pastor-i-rukopolozhenie/","/en/articles/pastor-elder-and-ordination/"]);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
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
const MUTABLE_DISCOVERY_FILES = new Set([
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/llms-full.txt",
  "/home-article-feed.js"
]);

function russianHome(html) {
  return html
    .replace('<html lang="en">', '<html lang="ru">')
    .replace('<body class="lang-en">', '<body class="lang-ru">')
    .replace('aria-label="Menu"', 'aria-label="Меню"')
    .replace('Spasenie Church — Sunday at 1 PM, Thursday at 7 PM', 'Церковь «Спасение» — воскресенье 13:00, четверг 19:00')
    .replace('Russian-Speaking Church in Orlando &amp; Winter Park | Spasenie', 'Русскоязычная церковь в Орландо и Winter Park | Спасение')
    .replace('Visit Spasenie, a Russian-speaking church in Winter Park near Orlando, Florida. Sunday worship at 1 PM. 701 Formosa Avenue. Directions and first-visit information.', 'Церковь «Спасение» в Winter Park, рядом с Орландо, Флорида. Богослужение в воскресенье в 13:00. 701 Formosa Avenue. Адрес, маршрут и информация для первого визита.')
    .replace('<link rel="canonical" href="https://orlandorussianchurch.com/">', '<link rel="canonical" href="https://orlandorussianchurch.com/ru/">')
    .replace('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="ru_RU">')
    .replace('<meta property="og:locale:alternate" content="ru_RU">', '<meta property="og:locale:alternate" content="en_US">')
    .replace('Spasenie Church | Russian-Speaking Church in Orlando', 'Церковь Спасение | Русскоязычная церковь в Орландо')
    .replace('Russian-language worship in Winter Park every Sunday at 1 PM, with Bible study and prayer on Thursdays at 7 PM.', 'Русскоязычное богослужение в Winter Park каждое воскресенье в 13:00; изучение Библии и молитва по четвергам в 19:00.')
    .replace('<meta property="og:url" content="https://orlandorussianchurch.com/">', '<meta property="og:url" content="https://orlandorussianchurch.com/ru/">')
    .replace('<section class="wrap" aria-label="Visitor information">', '<section class="wrap" aria-label="Информация для посетителей">')
    .replace('<h1>Russian-speaking church in Winter Park, near Orlando</h1>', '<h1>Русскоязычная церковь в Winter Park, рядом с Орландо</h1>')
    .replace('Spasenie Church meets at 701 Formosa Avenue, Winter Park, Florida. Sunday worship begins at 1:00 PM. The Thursday Bible study and prayer meeting begins at 7:00 PM. Services are held primarily in Russian.', 'Церковь «Спасение» собирается по адресу 701 Formosa Avenue, Winter Park, Florida. Воскресное богослужение начинается в 13:00. Изучение Библии и молитва по четвергам начинаются в 19:00. Основной язык встреч — русский.')
    .replace('<a href="/ru/">Русская версия</a> · <a href="/en/articles/">English articles</a>', '<a href="/stati/">Статьи на русском</a> · <a href="/">English homepage</a>')
    .replace('<a href="/en/articles/russkoyazychnaya-cerkov-orlando-winter-park/">Address and weekly schedule</a> · <a href="/en/articles/pervyi-vizit-v-russkuyu-cerkov-orlando/">Plan your first visit</a> · <a href="/ru/">Русская версия</a>', '<a href="/stati/russkoyazychnaya-cerkov-orlando-winter-park/">Адрес и расписание</a> · <a href="/stati/pervyi-vizit-v-russkuyu-cerkov-orlando/">Первый визит</a> · <a href="/">English homepage</a>')
    .replace(/(["'])img\//g, '$1/img/')
    .replace(/(["'])video\/([^"']+\.(?:mp4|webm|ogg))\1/g, '$1/video/$2$1');
}

function send(res, code, body, type, cache) {
  // Share the site's icons with both language indexes and article pages.
  if (code === 200 && type.startsWith("text/html")) {
    const html = body.toString();
    if (!/<link\b[^>]*rel=["'](?:shortcut )?icon["']/i.test(html)) {
      body = html.replace(/<\/head>/i, '<link rel="icon" type="image/png" sizes="96x96" href="/favicon.png"><link rel="icon" type="image/x-icon" sizes="32x32" href="/favicon.ico"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"></head>');
    }
  }
  res.writeHead(code, { ...HEADERS, "Content-Type": type, "Cache-Control": cache });
  res.end(body);
}

function sendVideo(req, res, file, size) {
  const headers = {
    ...HEADERS,
    "Content-Type": "video/mp4",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes"
  };
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range.trim());
    if (!match || (!match[1] && !match[2])) {
      res.writeHead(416, { ...headers, "Content-Range": `bytes */${size}` });
      return res.end();
    }
    if (match[1]) {
      start = Number(match[1]);
      if (match[2]) end = Number(match[2]);
    } else {
      const suffix = Number(match[2]);
      start = Math.max(0, size - suffix);
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start || (!match[1] && Number(match[2]) === 0)) {
      res.writeHead(416, { ...headers, "Content-Range": `bytes */${size}` });
      return res.end();
    }
    end = Math.min(end, size - 1);
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["Content-Length"] = end - start + 1;
  res.writeHead(status, headers);
  if (req.method === "HEAD") return res.end();
  const stream = fs.createReadStream(file, { start, end });
  stream.on("error", () => res.destroy());
  stream.pipe(res);
}

function notFound(res, pathname) {
  const russian = pathname.startsWith("/ru/") || pathname.startsWith("/stati/");
  const page = russian ? "404-ru.html" : "404.html";
  fs.readFile(path.join(ROOT, page), (error, html) => {
    send(res, 404, error ? "Not found" : html, error ? "text/plain; charset=utf-8" : "text/html; charset=utf-8", "no-store");
  });
}

http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    return send(res, 400, "Bad request", "text/plain; charset=utf-8", "no-store");
  }

  const retiredPath = pathname.replace(/\/index\.html$/, "/").replace(/\/?$/, "/");
  if (RETIRED_PATHS.has(retiredPath)) {
    res.writeHead(410, { ...HEADERS, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
    return res.end('<html lang="en"><head><meta name="robots" content="noindex"><title>Page removed</title></head><body><p>This page has been removed. / Страница снята с публикации.</p><a href="/stati/">Статьи</a> · <a href="/en/articles/">Articles</a></body></html>');
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
    return notFound(res, pathname);
  }

  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(ROOT, relative);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    return notFound(res, pathname);
  }

  fs.stat(file, (statError, stats) => {
    const target = !statError && stats.isDirectory() ? path.join(file, "index.html") : file;
    if (!statError && stats.isFile() && path.extname(target).toLowerCase() === ".mp4") {
      return sendVideo(req, res, target, stats.size);
    }
    fs.readFile(target, (readError, data) => {
      if (readError) {
        return notFound(res, pathname);
      }
      const ext = path.extname(target).toLowerCase();
      const cache = ext === ".html" || ext === ".csv" || MUTABLE_DISCOVERY_FILES.has(pathname)
        ? "public, max-age=600"
        : "public, max-age=31536000, immutable";
      send(res, 200, data, TYPES[ext] || "application/octet-stream", cache);
    });
  });
}).listen(PORT, () => console.log(`spasenie static server on :${PORT}`));
