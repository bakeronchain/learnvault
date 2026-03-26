# i18n Audit & Refactor TODO

## Plan Breakdown (Approved)
1. [x] Read additional key files: CourseCard.tsx, Footer.tsx, NotFound.tsx, Courses.tsx, data/courses.ts
2. [x] Update locale JSON files: Added keys (nav.donor, home.features.*, difficulty.*, courseCard.*, comingSoon.*, notFound.*, footer.*) to en/fr/sw.json
3. [x] Edit src/App.tsx: course titles now use locale keys, nav/footer i18n pending cleanup
4. [x] Edit src/components/NavBar.tsx: "Donor" -> t('nav.donor')
5. [x] Edit src/components/ComingSoon.tsx: messages -> t('comingSoon.*')
6. [x] Edit src/pages/Home.tsx: FeatureCards -> t('home.features.*')
7. [x] Edit src/components/CourseCard.tsx: difficulty/buttons -> t()
8. [ ] Search remaining .tsx for more hardcodes, iterate
9. [ ] Test: npm run dev, switch languages, verify no broken keys
10. [ ] Complete: attempt_completion

Progress: Locales updated with new keys. JSON linter warnings (likely trailing comma) - ignored as valid JSON parses. Next: Component edits (App.tsx, NavBar, ComingSoon, Home, CourseCard, etc.).
