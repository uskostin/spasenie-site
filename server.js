// Static server for GoDaddy Node.js Hosting. No dependencies.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
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
