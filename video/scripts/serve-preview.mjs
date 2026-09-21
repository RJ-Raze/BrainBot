import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
const root = fileURLToPath(new URL("../out/", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".png": "image/png",
  ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405).end();
      return;
    }
    const pathname = decodeURIComponent(
      new URL(req.url, "http://127.0.0.1").pathname,
    );
    const file = path.resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    const relative = path.relative(root, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      res.writeHead(403).end();
      return;
    }
    const s = await stat(file);
    if (!s.isFile()) {
      res.writeHead(404).end();
      return;
    }
    const headers = {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    };
    let start = 0,
      end = s.size - 1,
      status = 200;
    if (req.headers.range) {
      const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if (!m) {
        res.writeHead(416, { "Content-Range": `bytes */${s.size}` }).end();
        return;
      }
      start = Number(m[1]);
      end = m[2] ? Math.min(Number(m[2]), s.size - 1) : end;
      if (start > end) {
        res.writeHead(416, { "Content-Range": `bytes */${s.size}` }).end();
        return;
      }
      status = 206;
      headers["Content-Range"] = `bytes ${start}-${end}/${s.size}`;
    }
    headers["Content-Length"] = end - start + 1;
    res.writeHead(status, headers);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    const stream = createReadStream(file, { start, end });
    stream.on("error", () => res.destroy());
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  } catch {
    res.writeHead(404).end("File not found");
  }
});
server.listen(4260, "127.0.0.1", () =>
  console.log("BrainBot film: http://127.0.0.1:4260/"),
);
