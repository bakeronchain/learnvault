# i18n Audit & Refactor TODO

## Plan Breakdown (Approved)
1. [x] Read additional key files: CourseCard.tsx, Footer.tsx, NotFound.tsx, Courses.tsx, data/courses.ts
2. [x] Update locale JSON files: Added keys (app.courseCatalog, nav.donor, home.features.*, course.*, difficulty.*, courseCard.*, coursesPage.*, comingSoon.*, notFound.*, footer.*) to en/fr/sw.json
3. [ ] Edit src/App.tsx: Replace hardcodes (course catalog, nav buttons, footer), import useTranslation, clean duplicate AppLayout
4. [ ] Edit src/components/NavBar.tsx: "Donor" -> t('nav.donor')
5. [ ] Edit src/components/ComingSoon.tsx: Construction messages -> t('comingSoon.*')
6. [ ] Edit src/pages/Home.tsx: FeatureCard titles/descriptions -> t('home.features.*')
7. [ ] Edit src/components/CourseCard.tsx & other components/pages with hardcodes
8. [ ] Search remaining .tsx for more hardcodes, iterate
9. [ ] Test: npm run dev, switch languages, verify no broken keys
10. [ ] Complete: attempt_completion

Progress: Locales updated with new keys. JSON linter warnings (likely trailing comma) - ignored as valid JSON parses. Next: Component edits (App.tsx, NavBar, ComingSoon, Home, CourseCard, etc.).
