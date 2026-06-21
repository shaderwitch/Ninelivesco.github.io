# Nine Lives Co. — ninelives.repair

The public site for **Nine Lives Co. (Console Necromancy)** — currently a
coming-soon page. Styled entirely by the [Necromancy](https://github.com/shaderwitch/Necromancy)
framework, which builds on [kitten-core](https://github.com/shaderwitch/kitten-core).
Both are vendored here as **git submodules** and compiled in as source, so this
repo builds the whole site by itself.

## Layout

```
packages/
  necromancy/   submodule → shaderwitch/Necromancy    (brand layer: tokens, base, components, partials, build harness)
  kitten-core/  submodule → shaderwitch/kitten-core    (brand-free foundation: roles, engine, behaviours)
sites/
  ninelives/    the site (HBS + SCSS + JS; @ninelives/site)
.github/workflows/deploy.yml   push to main → build → rsync to Hetzner
```

## Develop

```bash
git clone --recursive https://github.com/shaderwitch/Ninelivesco.github.io.git
cd Ninelivesco.github.io
npm install
npm start          # live-reload dev loop at http://localhost:8097
```

> Already cloned without `--recursive`? Run `git submodule update --init --recursive`.

`npm start` watches the site **and** both framework submodules — edit framework
SCSS/JS and the page hot-reloads. SCSS saves hot-swap the stylesheet; template /
data / JS saves do a full reload.

## Build

```bash
npm run build      # → sites/ninelives/dist/  (index.html, css/main.css, js/)
```

## Deploy

Push to `main` → the GitHub Action checks out the submodules, builds, and rsyncs
`sites/ninelives/dist/` to the Hetzner web root over SSH. **Push = live.**

### Required repository secrets

Set these under **Settings → Secrets and variables → Actions**:

| Secret | What it is |
| --- | --- |
| `SUBMODULES_TOKEN` | A GitHub PAT with **read** access to `shaderwitch/Necromancy` and `shaderwitch/kitten-core` (the default `GITHUB_TOKEN` cannot read other private repos, so the recursive submodule checkout needs this). |
| `SSH_PRIVATE_KEY` | Private key of a deploy keypair; its public key is in the Hetzner user's `~/.ssh/authorized_keys`. |
| `SSH_KNOWN_HOSTS` | Output of `ssh-keyscan <hetzner-host>` (pins the server's host key). |
| `HETZNER_HOST` | Server hostname or IP. |
| `HETZNER_USER` | SSH user that owns the web root. |
| `HETZNER_PATH` | Absolute path of the web root, e.g. `/var/www/ninelives`. |

DNS and the web server (nginx → `ninelives.repair`) are configured on the server,
not in this repo.

## Updating the framework

The submodules are pinned to specific commits. To pull newer framework work:

```bash
git -C packages/necromancy pull origin main
git -C packages/kitten-core pull origin main
git add packages/necromancy packages/kitten-core
git commit -m "chore: bump framework submodules"
git push
```
