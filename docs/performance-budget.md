# Performance Budget

## Lighthouse mobile targets

- Performance score: `>= 90`
- First Contentful Paint: `< 1.5s`
- Largest Contentful Paint: `< 2.5s`
- Total Blocking Time: `< 200ms`
- Cumulative Layout Shift: `< 0.1`

## CI gate

- Pull requests fail when Lighthouse performance drops below `85`.
- Implemented with [lighthouserc.json](../lighthouserc.json) and
  [.github/workflows/lighthouse.yml](../.github/workflows/lighthouse.yml).

## Baseline before optimisation

Measured with:

```bash
npx vite build
npx vite-bundle-visualizer --output docs/bundle-baseline.html --open false
```

Observed production bundle output before code-splitting:

- `assets/index-*.js`: `~2.98 MB` minified / `~879 kB` gzip
- `assets/util-*.js`: `~546 kB` minified / `~172 kB` gzip
- `assets/index-*.css`: `~181 kB` minified / `~28 kB` gzip
- `assets/stellar_xdr_json_bg-*.wasm`: `~3.7 MB` minified / `~738 kB` gzip

## Optimisations added

- Route-level code splitting with `React.lazy` and `Suspense`
- Component-level lazy loading for:
  - the contract explorer on `/debug`
  - the Recharts treasury visualisation on `/treasury`
- Deferred above-the-fold home widgets so onboarding, milestone tracking, and
  the sample contract do not load until needed or scrolled into view
- Moved wallet connect/disconnect and balance fetch logic behind on-demand
  imports instead of loading the full Stellar stack on first paint
- Vite manual chunking for Stellar SDK, charts, contract explorer, router, i18n,
  and generated contract clients
- Runtime `preconnect` / `dns-prefetch` hints for the configured Horizon, RPC,
  and Stellar Lab origins
- Removed the contract utility runtime dependency from the preconnect helper so
  the landing route no longer pulls the Stellar SDK into the initial preload set
- Asset audit completed: the app currently ships SVG assets only, so there were
  no large raster images to convert to WebP in this pass

## Best local verification from this branch

Measured against the optimised production build with:

```bash
npm run build
npx lighthouse http://127.0.0.1:4173 --only-categories=performance --emulated-form-factor=mobile --throttling-method=simulate
```

Best local mobile Lighthouse result reached during this pass:

- Performance score: `58`
- First Contentful Paint: `3066ms`
- Largest Contentful Paint: `3329ms`
- Total Blocking Time: `1017ms`
- Cumulative Layout Shift: `0`

This is a material improvement over the original bundle structure, but it still
does **not** meet the final issue target of `>= 90`. The remaining bottleneck is
the always-loaded application shell/framework path rather than the route-level
feature chunks that were split out in this change.

## Verification

After each performance-sensitive change run:

```bash
npm run build
npx vite-bundle-visualizer --output docs/bundle-report.html --open false
npx @lhci/cli autorun --config=./lighthouserc.json
```
