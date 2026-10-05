# Deploying Livanta to Cloudflare Pages

Livanta is a Next.js **static export** (`output: "export"` in `next.config`),
which publishes to `out/`. Cloudflare Pages serves that directory directly.

These settings live in the Cloudflare dashboard, not in the repository, so they
are recorded here where they can be reviewed and diffed.

## Project settings

| Setting | Value | Why |
| --- | --- | --- |
| Framework preset | None | The output is a plain static directory, not something Cloudflare needs to build specially |
| Build command | `npm run build` | Produces `out/` |
| Build output directory | `out` | Matches `output: "export"` |
| Root directory | *(repository root)* | `next.config` and `app/` live at the top level |
| Node version | `24` | Set `NODE_VERSION=24` in the environment variables. This replaced `netlify.toml` |

## Response headers

Handled by `public/_headers`, which the build copies to the root of the published
directory where Cloudflare reads it. Two rules:

- `/_next/static/*` is immutable for a year. Next.js emits content-hashed
  filenames there, so the bytes behind a URL can never change.
- Everything else is `must-revalidate`. Without this, a deploy would keep serving
  a stale `index.html` to anyone who had already visited.

Security headers, including a Content-Security-Policy, are set on the catch-all
rule. If the CSP ever blocks something, `connect-src` is the directive to look at:
it currently allows only `self` and `https://*.supabase.co`, which is correct for
cloud sync and deliberately does not permit arbitrary outbound calls.

## Routes

`trailingSlash: true` means the build emits `out/translations/index.html` and
Cloudflare serves it at `/translations/` with no redirect rule needed. The same
applies to `/404/`.

## Gating the beta

Cloudflare has no Netlify-style "password protect the site" toggle. The
equivalent is **Cloudflare Access** (Zero Trust):

1. Zero Trust dashboard, then **Access > Applications**, and add the Pages
   hostname.
2. Set the policy to **Allow** a list of email addresses, or one named group.
3. Each tester gets their own login, and you can remove one without affecting
   anyone else.

Free for up to 50 users. This is configured entirely in the Zero Trust dashboard;
there is nothing to add to this repository.

## Server-side functions

Not built yet. When the Paystack sidecar arrives it goes in `functions/` at the
repository root, which Cloudflare Pages discovers automatically.

Three things to set up before writing them:

- **Compatibility flag.** Pages Functions run on the Workers runtime. Set
  `nodejs_compat` for the project if any Node APIs are needed.
- **Secrets.** `PAYSTACK_SECRET_KEY` goes in the Pages environment variables,
  never in the repository and never with a `NEXT_PUBLIC_` prefix. `.dev.vars` is
  the local equivalent and is gitignored.
- **Webhook body.** Read the raw request text before verifying the HMAC. A
  re-serialised body produces a different signature.

See `docs/Livanta Subscription Architecture.md` for the full design.

## Local checking

```bash
npm run build          # produces out/
npm start              # serves out/ on http://localhost:3101
npm run qa:responsive  # audits out/ at five viewports
```

`npm start` is dependency-free and needs no network, so it works offline. For a
preview that matches production exactly, including the `_headers` rules:

```bash
npm run build
npx wrangler dev            # honours wrangler.jsonc and public/_headers
```

## Service worker and cache headers

Two header rules matter more than they look. `/sw.js` and `/manifest.webmanifest`
are served `max-age=0, must-revalidate`, and that is deliberate: a browser
compares the bytes of a cached service worker against its copy, so a cached
worker means updates are never applied while appearing to succeed.

`worker-src 'self'` is stated explicitly in the CSP. It currently falls back to
`script-src`, which already allows `'self'`, but stating it means a later
tightening of `script-src` cannot silently break offline support.

`_headers` is honoured by Workers static assets, so the same file works whether
the project is deployed as Pages or as a Workers assets upload.

## Workers, not Pages, and not OpenNext

The project deploys as a **Workers static-assets upload**, configured in
`wrangler.jsonc`: `assets.directory` is `./out` and there is deliberately no
`main`, because this is a static export with no server code.

The build environment once auto-detected `Framework: Next.js` and wired up
OpenNext, which requires a standalone Node build at `.next/standalone`. A static
export never produces that directory, so the deploy failed with:

```
Error: ENOENT: no such file or directory, open
  '.next/standalone/.next/server/pages-manifest.json'
```

OpenNext is only correct if the app later gains SSR or API routes. Until then it
is strictly wrong, and the committed `wrangler.jsonc` is what prevents
auto-detection from choosing it again.

## What happened to Netlify

The project was deployed to Netlify first. `netlify.toml` and the
`netlify-cli` dependency have been removed, and `.netlify/` stays gitignored so an
old checkout's link state is still ignored. The old site at
`livanta.netlify.app` is frozen at an older commit and is not being updated.
