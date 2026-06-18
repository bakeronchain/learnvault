# Mobile responsive layout audit

This document tracks verification for the mobile-responsive layout work across
LearnVault frontend pages.

## Pages covered

| Page                    | Route                                  |
| ----------------------- | -------------------------------------- |
| Landing / Home          | `/`                                    |
| Course Catalog          | `/courses`                             |
| Lesson Player           | `/courses/:courseId/lessons/:lessonId` |
| Learner Dashboard       | `/dashboard`                           |
| Scholarship Application | `/scholarships/apply`                  |
| DAO Voting              | `/dao`, `/dao/proposals`               |
| Leaderboard             | `/leaderboard`                         |
| Learner Profile         | `/profile`                             |
| Donor Dashboard         | `/donor`                               |

## Breakpoints to verify

- 375px (iPhone SE)
- 414px (iPhone Plus)
- 768px (tablet portrait)
- 1024px (tablet landscape / small laptop)
- 1440px (desktop)

## Acceptance criteria

- [x] Navigation collapses to hamburger menu below `md` (`NavBar`)
- [x] Global `overflow-x: hidden` guard on `html`/`body`
- [x] Shared `.responsive-table` utility for horizontal table scroll
- [x] Shared `.touch-target` utility (44×44px minimum)
- [x] Scholarship form stacks to single column below 720px
- [x] Lesson player uses slide-out sidebar on mobile
- [x] Page padding reduced on small screens (`p-6 md:p-12` pattern)

## Automated audit

From repo root:

```bash
npm run build
npx playwright install chromium
npm run test:responsive
```

- **45/45** Playwright layout tests pass at 375, 414, 768, 1024, and 1440px.
- 375px full-page screenshots are committed under
  `docs/mobile-responsive-screenshots/`.

## Lighthouse mobile score (home page, production build)

| Category       | Score |
| -------------- | ----: |
| Performance    |    37 |
| Accessibility  |    96 |
| Best Practices |    96 |
| SEO            |    91 |

Report: `docs/lighthouse-mobile.html`

Performance is below the optional ≥90 target (large JS bundles on localhost). PR
acceptance is satisfied via the committed 375px screenshots above.
