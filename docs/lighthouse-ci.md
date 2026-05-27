# Lighthouse CI

The E2E workflow runs Lighthouse CI on pull requests after the Playwright suite.

## Target URL

Set the repository variable `STAGING_URL` to audit the deployed staging app on every PR.
When `STAGING_URL` is not configured, the workflow builds the app and audits the local
Vite preview server at `http://127.0.0.1:4173`.

## Score Gates

The CI gate fails when a category falls below:

- Performance: 80
- Accessibility: 90
- Best Practices: 90
- SEO: 80

The workflow uploads the `.lighthouseci` report folder as an artifact and posts a score
summary comment on the pull request.
