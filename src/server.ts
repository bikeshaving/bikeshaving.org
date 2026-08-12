import {jsx} from "@b9g/crank/standalone";
import {renderer} from "@b9g/crank/html";
import {Router} from "@b9g/router";
import {Marked} from "@b9g/crankdown";

function Page({title, children}: {title: string; children: unknown}) {
  return jsx`
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
        <style>${`
body {
  font-family: "Atkinson Hyperlegible Next", sans-serif;
  max-width: 72ch;
  margin: 2rem auto;
  padding: 0 1rem;
  line-height: 1.6;
  color: #1a1a2e;
  background: #fafafa;
}
a { color: #16213e; }
a:hover { color: #0f3460; }
h1 { font-size: 1.4rem; color: #0f3460; }
h2 { font-size: 1.1rem; margin-top: 2rem; color: #16213e; }
ul { padding-left: 1.5rem; }
li { margin-bottom: 0.5rem; }
dl { margin: 1.5rem 0; }
dt { margin-top: 1rem; }
dd { margin-left: 1.5rem; margin-top: 0.25rem; }
strong { color: #0f3460; }
em { color: #555; }
        `}</style>
      </head>
      <body>${children}</body>
    </html>
  `;
}

async function loadContent(path: string): Promise<string> {
  const contentDir = await self.directories.open("content");
  const file = await contentDir.getFileHandle(path);
  const f = await file.getFile();
  return f.text();
}

const router = new Router();
router.route("/").get(async () => {
  const markdown = await loadContent("index.md");
  const html = await renderer.render(jsx`
    <${Page} title="bikeshaving">
      <${Marked} markdown=${markdown} />
    <//>
  `);
  return new Response("<!DOCTYPE html>" + html, {
    headers: {"content-type": "text/html; charset=utf-8"},
  });
});

self.addEventListener("fetch", (ev) => {
  ev.respondWith(router.handle(ev.request));
});

// Cloudflare Pages reads this from the deploy root. Pages' default for HTML is
// max-age=0, must-revalidate (a full round-trip every visit); since content
// only changes on deploy, let browsers reuse pages briefly and revalidate in
// the background instead.
const HEADERS_FILE = `/*
  Cache-Control: public, max-age=300, stale-while-revalidate=86400
`;

async function writePublicFile(
  publicDir: FileSystemDirectoryHandle,
  path: string,
  contents: string,
): Promise<void> {
  const file = await publicDir.getFileHandle(path, {create: true});
  const writable = await file.createWritable();
  await writable.write(contents);
  await writable.close();
}

self.addEventListener("install", (ev) => {
  ev.waitUntil((async () => {
    const publicDir = await self.directories.open("public");
    const routes = ["/"];
    for (const route of routes) {
      const response = await fetch(route);
      const html = await response.text();
      const path = route === "/" ? "index.html" : `${route.slice(1)}/index.html`;
      await writePublicFile(publicDir, path, html);
    }

    await writePublicFile(publicDir, "_headers", HEADERS_FILE);

    // Without a 404.html, Pages serves index.html with a 200 for every
    // unknown path (SPA fallback) — soft 404s on a content site.
    const notFound = await renderer.render(jsx`
      <${Page} title="bikeshaving — not found">
        <h1>404 — Not Found</h1>
        <p>There is nothing at this address. <a href="/">Return home.</a></p>
      <//>
    `);
    await writePublicFile(publicDir, "404.html", "<!DOCTYPE html>" + notFound);
  })());
});
