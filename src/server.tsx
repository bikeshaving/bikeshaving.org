import {Router} from "@b9g/router";
import {renderer} from "@b9g/crank/html";

const projects = [
  {name: "Crank.js", url: "https://github.com/bikeshaving/crank", description: "The Just JavaScript UI Framework"},
  {name: "Repeater.js", url: "https://github.com/repeaterjs/repeater", description: "The missing constructor for creating safe async iterators"},
  {name: "Shovel.js", url: "https://github.com/bikeshaving/shovel", description: "Run Service Workers anywhere"},
  {name: "ZenDB", url: "https://github.com/bikeshaving/zendb", description: "Define Zod tables. Write raw SQL. Get typed objects."},
  {name: "Revise.js", url: "https://github.com/bikeshaving/revise", description: "Rich text editing foundations for the web"},
  {name: "Skillpack", url: "https://github.com/bikeshaving/skillpack", description: "Build Agent Skills from your existing docs"},
  {name: "Libuild", url: "https://github.com/bikeshaving/libuild", description: "Zero-config library builds with ESBuild"},
  {name: "Crank.py", url: "https://github.com/bikeshaving/crankpy", description: "Python Frontend Framework, Powered by Crank.js"},
];

function Page({title, children}: {title: string; children: unknown}) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
        <style>{`
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
      <body>{children}</body>
    </html>
  );
}

function Home() {
  return (
    <Page title="bikeshaving">
      <h1>bikeshaving</h1>
      <p>Open source software by <a href="https://github.com/brainkim">Brian Kim</a>.</p>

      <dl>
        <dt><strong>bikeshedding</strong> /ˈbaɪkˌʃɛdɪŋ/ <em>n.</em></dt>
        <dd>The tendency towards spending disproportionate time and attention to trivial details. From Parkinson’s <em>Law of Triviality</em>: a committee approves a nuclear reactor without comment but argues for hours over what color to paint the bike shed.</dd>

        <dt><strong>yak shaving</strong> /ˈjækˌʃeɪvɪŋ/ <em>n.</em></dt>
        <dd>The act of performing a seemingly endless chain of small tasks to accomplish a larger goal. You want to wax your car, but first you need to borrow a hose, but the hose is broken, so you need to go to the store, but your car won't start, so you need to fix the alternator, and before you know it you're shaving a yak.</dd>

        <dt><strong>bikeshaving</strong> /ˈbaɪkˌʃeɪvɪŋ/ <em>n.</em></dt>
        <dd>The pursuit of foundational technology through obsessive attention to prerequisites and details. As the bicycle required metallurgy, rubber vulcanization, and precision machining, yet is ultimately the meeting of simple machines, gyroscopic motion, and human kinematics. The result greater than the sum of its parts.</dd>
      </dl>

      <h2>Projects</h2>
      <ul>
        {projects.map((p) => (
          <li><a href={p.url}>{p.name}</a> — {p.description}</li>
        ))}
      </ul>

      <h2>Links</h2>
      <ul>
        <li><a href="https://github.com/bikeshaving">GitHub</a></li>
        <li><a href="https://www.npmjs.com/~brainkim">npm</a></li>
        <li><a href="mailto:contact@bikeshaving.org">contact@bikeshaving.org</a></li>
      </ul>
    </Page>
  );
}

const router = new Router();
router.route("/").get(async () => {
  const html = await renderer.render(<Home />);
  return new Response("<!DOCTYPE html>" + html, {
    headers: {"content-type": "text/html; charset=utf-8"},
  });
});

self.addEventListener("fetch", (ev) => {
  ev.respondWith(router.handle(ev.request));
});

self.addEventListener("install", (ev) => {
  ev.waitUntil((async () => {
    const publicDir = await self.directories.open("public");
    const routes = ["/"];
    for (const route of routes) {
      const response = await fetch(route);
      const html = await response.text();
      const path = route === "/" ? "index.html" : `${route.slice(1)}/index.html`;
      const file = await publicDir.getFileHandle(path, {create: true});
      const writable = await file.createWritable();
      await writable.write(html);
      await writable.close();
    }
  })());
});
