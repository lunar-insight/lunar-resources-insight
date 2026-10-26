# Build and dependency security

## Scope

Where npm package code runs, how dependencies enter the repository, what the image
builds check, and what the browser allows in development and in production. Excludes
the header policy of the tile path (`tile-and-point-serving.md`) and the hardening of
the planetcantile containers, which belongs to that repository.

## Structure

```
 host: editor, git, Firefox, Docker CLI          nothing from node_modules runs here
   |
   +-- node_modules                               copy of the dev image's tree, for
   |                                              editor types; no .bin, no native binaries
   |
   +-- scripts/deps.sh ----> throwaway npm container, no mounts
   |                         package.json, package-lock.json, .npmrc copied in and out
   |
   +-- docker compose
   |     launch-check  audit and OSV on the lockfile; dev and test start only if it passes
   |     dev      Vite         read-only source mounts, internal network only
   |     test     Vitest       read-only source mounts, no network
   |     terrain  tile server  read-only terrain mount, internal network only
   |     proxy    nginx        the only service with published ports and outbound access
   |
   +-- docker build
   |     npm ci (no install scripts) -> signature check -> audit
   |     production image only, without network:
   |       hardening check -> tests -> build -> bundle host check
   |
   +-- scripts/open-app.sh --> Firefox profile whose pages reach only localhost

 production: nginx serves the bundle, the terrain and the proxied tiler under a CSP
 that forbids evaluating strings, inline scripts and connections to other origins
```

## Design rationale

An npm package runs with the permissions of whatever starts it: the installer, the
test runner, the dev server, the bundler. On the host those permissions include the
user's files, git credentials and any AI agent installed there. Package code therefore
runs only in containers that hold no credentials, see the source read-only, and have no
outbound network, so code that turns hostile has nothing to read and nowhere to send
it.

Dependencies enter only through a container with no access to the host files, and only
in versions older than a minimum release age: most malicious releases are detected and
withdrawn within days. The delay inspects nothing, so lockfile review and a diff of the
changed package cover what it misses.

Whatever is in the bundle still runs in every user's browser. The production CSP limits
what that code can do: it cannot evaluate strings, run inline scripts or connect to
other origins. That policy constrains the application code, as described under
"Production CSP".

## Components

### Dependency changes

`scripts/deps.sh` runs any npm command in a throwaway container built from the dev
image. The package files are copied in and back, also when npm exits with an error, so
`git diff` is the review. `.npmrc` disables install scripts and git dependencies, sets
the minimum release age and saves exact versions. A security fix younger than the
release age goes through the exception procedure in the README.
`scripts/lockdiff.cjs` lists the changed packages between two lockfiles and flags any
not served by the npm registry or without an integrity hash. `scripts/osv-scan.sh`
checks the lockfile with the official OSV-Scanner image, whose database includes known
malicious packages.

### Development containers

`dev` and `test` share one block of restrictions in `docker-compose.yml`: unprivileged
user, no capabilities, no privilege escalation, read-only root filesystem, process and
memory limits. They mount only the files they read, read-only. `dev` reaches the proxy
over an internal network; `test` has no network interface. Temporary check pages go in
`src/scratch/`, which is mounted with the rest of `src`.

### Host node_modules

`scripts/sync-node-modules.sh` copies `node_modules` out of the dev image for the
editor's type checking, leaving out `.bin` and the native binary packages, so nothing in
the copy can be started. `.vscode/settings.json` turns off automatic type acquisition,
which would download type packages outside the release age, and the npm scripts view.

### Image builds

Both images install from the lockfile with install scripts disabled, then fail on an
invalid registry signature or an advisory of high severity. The production build then
runs, without network, the hardening check, the full test suite, the bundle build and
`scripts/check-bundle-hosts.cjs`, which fails on an `http(s)` host in the bundle's code
that is missing from `scripts/bundle-hosts.txt`. Base images are pinned by digest.

A cached build reuses an earlier audit result until the package files change, so it
misses an advisory published since. The production build therefore runs without cache,
and also runs the launch check after copying the sources.

### Launch check

Advisories appear after a dependency is installed. The `launch-check` service runs
`scripts/check-dependencies.cjs` before `dev` and `test` start, so every launch checks
the lockfile without anyone remembering to. npm audit blocks on a high or critical
advisory; the OSV database blocks on a known malicious package and reports its other
advisories. Without network the check warns and the launch continues, so offline work
stays possible. `--no-deps` starts the services without it; the check offers that only
when no malicious package is involved, since starting would run that package.

### Hardening check

`scripts/check-hardening.cjs` fails when a setting described here is missing or
loosened: the npm settings, the build context exclusions, the digests, the blocking
build steps, the container restrictions and published ports, the scripts that start
containers or Firefox, the locked Firefox prefs, the editor settings, and the
production and development CSPs and security headers. Every CSP in a config must pass,
so a second, weaker one is caught, and a location that sets any header must repeat the
headers it would otherwise inherit. The production build runs it; the build context
excludes the development nginx template and the editor settings, which are checked when
the script runs on the host.

`scripts/tests/` tests the checks with `node --test`: each loosened copy of a file must
fail with the rule named in the test, and equivalent rewrites (comments, YAML list
styles, Windows line endings) must still pass. The decisions of the launch check are
tested on fixed npm audit and OSV answers. The production build runs these tests.

### Production CSP

Scripts come only from the site itself. Three parts of the application follow from
that policy:

- The globe is a `CesiumWidget`. Cesium's `Viewer` includes Knockout, which evaluates a
  string when the bundle loads, and the CSP blocks it. `Viewer` widgets, including
  Cesium's navigation help, are not used; `HelpButton` provides the help.
- `index.html` has no inline script. The loading screen script is
  `public/loading-screen.js`.
- Terrain is served by the production nginx from the same origin.

`'wasm-unsafe-eval'` allows compiling WebAssembly, which Cesium's mesh decoder checks for
on load; it does not allow evaluating JavaScript. `worker-src 'self'` covers Cesium's
workers and the loading screen worker.

Every response also carries `X-Content-Type-Options: nosniff`, so a file is used only
as the type it is served with, and `Referrer-Policy: no-referrer`, so no page address
leaves the site. `server_tokens off` hides the nginx version. nginx gives a location
that sets any header none of the server's, so each such location repeats the two.

### Browser in development

`scripts/open-app.sh` and `scripts/firefox-bidi/drive.mjs` give Firefox the prefs in
`scripts/firefox-bidi/locked.user.js`: every request except to localhost goes to a closed
proxy port, and the channels that bypass a proxy (WebRTC, DNS prefetch, speculative
connections) are off. Code served by the dev server cannot send data off the machine
from that profile.

## Configuration reference

| concern | file |
|---|---|
| install scripts, release age, exact versions | `.npmrc` |
| npm in a container | `scripts/deps.sh` |
| lockfile review | `scripts/lockdiff.cjs` |
| OSV scan and its image | `scripts/osv-scan.sh` |
| check before each launch | `scripts/check-dependencies.cjs`, `launch-check` in `docker-compose.yml` |
| container restrictions, mounts, networks | `docker-compose.yml` |
| image build checks, base images | `Dockerfile`, `Dockerfile.dev`, `Dockerfile.proxy` |
| hardening rules | `scripts/check-hardening.cjs` |
| hosts allowed in the bundle | `scripts/bundle-hosts.txt`, `scripts/check-bundle-hosts.cjs` |
| production CSP and headers, terrain route | `nginx.conf` |
| development CSP | `nginx.dev.conf.template` |
| host node_modules copy | `scripts/sync-node-modules.sh` |
| editor settings | `.vscode/settings.json` |
| locked Firefox prefs | `scripts/firefox-bidi/locked.user.js` |
| globe construction | `src/components/viewer/CesiumComponent/CesiumComponent.tsx` |
