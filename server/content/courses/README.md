# LearnVault Course Content

This directory contains seed curriculum content for LearnVault demos and future
database seeding.

## Structure

- `index.json` — master catalog of published courses and their lesson files.
- `<courseId>/course.json` — per-course metadata (title, level, lesson list).
- `<courseId>/lessons/*.md` — lesson content in Markdown.
- `<courseId>/lessons/*.quiz.json` — quiz questions for each lesson.
- `<courseId>/milestone.quiz.json` — end-of-track milestone quiz.

## Notes

- Lesson quizzes follow the shape expected by `src/components/QuizEngine.tsx`.
- `reviewedBy` is intentionally left blank until a technical contributor signs
  off on the lesson accuracy.
