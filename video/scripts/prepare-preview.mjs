import { mkdir, copyFile } from "node:fs/promises";
await mkdir(new URL("../out/", import.meta.url), { recursive: true });
await copyFile(
  new URL("../preview/index.html", import.meta.url),
  new URL("../out/index.html", import.meta.url),
);
console.log("out/index.html prepared");
