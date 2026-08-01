import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const clientDir = path.join(root, "dist", "client");
const mobileClientDir = path.join(root, "native", "mobile", "www");
const workerEntry = path.join(root, "dist", "server", "index.js");
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOST ?? "0.0.0.0";

const contentTypes = new Map([
  [".apk", "application/vnd.android.package-archive"],
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "application/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".webmanifest", "application/manifest+json"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

if (!existsSync(workerEntry)) {
  console.error("No production build found. Run `npm run build` first.");
  process.exit(1);
}

const workerModule = await import(`${pathToFileURL(workerEntry).href}?t=${Date.now()}`);
const worker = workerModule.default;

if (!worker || typeof worker.fetch !== "function") {
  console.error("The production worker does not expose a fetch handler.");
  process.exit(1);
}

function resolveWithin(directory, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const candidate = path.resolve(directory, `.${decodedPath}`);
  const relative = path.relative(directory, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return candidate;
}

function resolveStaticFile(pathname) {
  if (
    pathname === "/native-mobile-preview" ||
    pathname === "/native-mobile-preview/"
  ) {
    return path.join(mobileClientDir, "index.html");
  }

  if (pathname.startsWith("/native-mobile-preview/")) {
    const mobilePath = pathname.slice("/native-mobile-preview".length);
    return resolveWithin(mobileClientDir, mobilePath);
  }

  if (pathname === "/") return null;
  return resolveWithin(clientDir, pathname);
}

async function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const staticFile = resolveStaticFile(pathname);
  if (!staticFile) return false;

  let fileStat;
  try {
    fileStat = await stat(staticFile);
  } catch {
    return false;
  }

  if (!fileStat.isFile()) return false;

  const extension = path.extname(staticFile).toLowerCase();
  const isHashedAsset =
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/native-mobile-preview/assets/");
  res.writeHead(200, {
    "Cache-Control":
      pathname === "/sw.js" || extension === ".html"
        ? "no-cache, no-store, must-revalidate"
        : isHashedAsset
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600",
    "Content-Length": String(fileStat.size),
    "Content-Type": contentTypes.get(extension) ?? "application/octet-stream",
  });

  if (req.method === "HEAD") {
    res.end();
  } else {
    createReadStream(staticFile).pipe(res);
  }
  return true;
}

async function sendWorkerResponse(req, res) {
  const host = req.headers.host ?? `localhost:${port}`;
  const url = new URL(req.url ?? "/", `http://${host}`);
  const init = {
    headers: req.headers,
    method: req.method,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = Readable.toWeb(req);
    init.duplex = "half";
  }

  const request = new Request(url, init);
  const executionContext = {
    passThroughOnException() {},
    waitUntil(promise) {
      Promise.resolve(promise).catch(() => {});
    },
  };
  const response = await worker.fetch(request, {}, executionContext);

  const headers = Object.fromEntries(response.headers);
  res.writeHead(response.status, headers);
  if (!response.body || req.method === "HEAD") {
    res.end();
    return;
  }
  Readable.fromWeb(response.body).pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (await serveStatic(req, res, pathname)) return;
    await sendWorkerResponse(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("Internal Server Error");
  }
});

server.listen(port, hostname, () => {
  console.log(`Local preview ready at http://localhost:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
