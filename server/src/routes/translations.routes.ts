import { Router } from "express"

import {
	createGlossaryTerm,
	deleteGlossaryTerm,
	getCourseTranslationEditorState,
	getLessonTranslationEditorState,
	getTranslatorQueue,
	grantTranslator,
	listGlossaryTerms,
	listTranslatorGrants,
	publishCourseTranslation,
	publishLessonTranslation,
	revokeTranslator,
	saveCourseTranslationDraft,
	saveLessonTranslationDraft,
	submitCourseTranslationForReview,
	submitLessonTranslationForReview,
	updateGlossaryTerm,
} from "../controllers/translations.controller"
import { requireCourseAdmin } from "../middleware/course-admin.middleware"
import {
	languageFromParam,
	languageFromQuery,
	requireTranslator,
} from "../middleware/translator.middleware"
import { type JwtService } from "../services/jwt.service"

// jwtService is accepted for parity with the other create*Router(jwtService)
// factories in this codebase; translator/admin auth here is verified
// independently (see translator.middleware.ts / course-admin.middleware.ts),
// same pattern course-admin routes already use.
export function createTranslationsRouter(_jwtService: JwtService): Router {
	const router = Router()

	/**
	 * @openapi
	 * /api/admin/translators:
	 *   get:
	 *     tags: [Translations]
	 *     summary: List translator grants
	 *     description: Course-admin only. Every wallet granted as a translator for a language, active and revoked.
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Translator grants
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 data:
	 *                   type: array
	 *                   items:
	 *                     $ref: '#/components/schemas/TranslatorGrant'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       403:
	 *         $ref: '#/components/responses/ForbiddenError'
	 *   post:
	 *     tags: [Translations]
	 *     summary: Grant a wallet translator access to a language
	 *     description: Course-admin only. Scoped per language — a grant for "sw" never authorizes "fr".
	 *     security:
	 *       - bearerAuth: []
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [walletAddress, languageCode]
	 *             properties:
	 *               walletAddress: { type: string }
	 *               languageCode: { type: string, enum: [es, fr, sw] }
	 *     responses:
	 *       201:
	 *         description: Grant created (or reactivated if previously revoked)
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/TranslatorGrant'
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       403:
	 *         $ref: '#/components/responses/ForbiddenError'
	 */
	router.get("/admin/translators", requireCourseAdmin, listTranslatorGrants)
	router.post("/admin/translators", requireCourseAdmin, grantTranslator)

	/**
	 * @openapi
	 * /api/admin/translators/{id}:
	 *   delete:
	 *     tags: [Translations]
	 *     summary: Revoke a translator grant
	 *     description: Course-admin only.
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: id
	 *         required: true
	 *         schema:
	 *           type: integer
	 *     responses:
	 *       204:
	 *         description: Grant revoked
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       403:
	 *         $ref: '#/components/responses/ForbiddenError'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 */
	router.delete("/admin/translators/:id", requireCourseAdmin, revokeTranslator)

	/**
	 * @openapi
	 * /api/courses/{idOrSlug}/glossary:
	 *   get:
	 *     tags: [Translations]
	 *     summary: List a course's do-not-translate glossary
	 *     description: Protocol nouns (e.g. LRN, Soroban, Stellar, escrow, wallet, testnet) that must survive a translation untouched.
	 *     parameters:
	 *       - in: path
	 *         name: idOrSlug
	 *         required: true
	 *         schema:
	 *           type: string
	 *     responses:
	 *       200:
	 *         description: Glossary terms
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 data:
	 *                   type: array
	 *                   items:
	 *                     $ref: '#/components/schemas/GlossaryTerm'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 *   post:
	 *     tags: [Translations]
	 *     summary: Add a glossary term
	 *     description: Course-admin only.
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: idOrSlug
	 *         required: true
	 *         schema:
	 *           type: string
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [term]
	 *             properties:
	 *               term: { type: string }
	 *               note: { type: string, nullable: true }
	 *     responses:
	 *       201:
	 *         description: Term created
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/GlossaryTerm'
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 *       409:
	 *         description: Term already exists for this course
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 */
	router.get("/courses/:idOrSlug/glossary", listGlossaryTerms)
	router.post(
		"/courses/:idOrSlug/glossary",
		requireCourseAdmin,
		createGlossaryTerm,
	)

	/**
	 * @openapi
	 * /api/courses/{idOrSlug}/glossary/{termId}:
	 *   patch:
	 *     tags: [Translations]
	 *     summary: Update a glossary term
	 *     description: Course-admin only.
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: idOrSlug
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: path
	 *         name: termId
	 *         required: true
	 *         schema:
	 *           type: integer
	 *     requestBody:
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             properties:
	 *               term: { type: string }
	 *               note: { type: string, nullable: true }
	 *     responses:
	 *       200:
	 *         description: Term updated
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/GlossaryTerm'
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 *   delete:
	 *     tags: [Translations]
	 *     summary: Delete a glossary term
	 *     description: Course-admin only.
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: idOrSlug
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: path
	 *         name: termId
	 *         required: true
	 *         schema:
	 *           type: integer
	 *     responses:
	 *       204:
	 *         description: Term deleted
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 */
	router.patch(
		"/courses/:idOrSlug/glossary/:termId",
		requireCourseAdmin,
		updateGlossaryTerm,
	)
	router.delete(
		"/courses/:idOrSlug/glossary/:termId",
		requireCourseAdmin,
		deleteGlossaryTerm,
	)

	/**
	 * @openapi
	 * /api/courses/{idOrSlug}/translations/{languageCode}:
	 *   get:
	 *     tags: [Translations]
	 *     summary: Get the course translation editor state
	 *     description: >
	 *       Translator (granted for languageCode) or course-admin only. Returns
	 *       the English source, any existing translation at any status, and the
	 *       course's do-not-translate glossary — everything the side-by-side
	 *       editor needs in one call.
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: idOrSlug
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: path
	 *         name: languageCode
	 *         required: true
	 *         schema:
	 *           type: string
	 *           enum: [es, fr, sw]
	 *     responses:
	 *       200:
	 *         description: Editor state
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 source:
	 *                   type: object
	 *                   properties:
	 *                     title: { type: string }
	 *                     description: { type: string }
	 *                     contentVersion: { type: integer }
	 *                 translation:
	 *                   type: object
	 *                   nullable: true
	 *                   allOf:
	 *                     - $ref: '#/components/schemas/CourseTranslation'
	 *                 glossary:
	 *                   type: array
	 *                   items:
	 *                     $ref: '#/components/schemas/GlossaryTerm'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       403:
	 *         $ref: '#/components/responses/ForbiddenError'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 *   put:
	 *     tags: [Translations]
	 *     summary: Save a course translation draft
	 *     description: >
	 *       Translator (granted for languageCode) or course-admin only. Upserts
	 *       title/description as a draft and stamps source_version to the
	 *       course's current content_version. Never changes an existing
	 *       in_review/published status — only submit/publish do that.
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: idOrSlug
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: path
	 *         name: languageCode
	 *         required: true
	 *         schema:
	 *           type: string
	 *           enum: [es, fr, sw]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [title, description]
	 *             properties:
	 *               title: { type: string }
	 *               description: { type: string }
	 *     responses:
	 *       200:
	 *         description: Saved translation
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/CourseTranslation'
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       403:
	 *         $ref: '#/components/responses/ForbiddenError'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 */
	router.get(
		"/courses/:idOrSlug/translations/:languageCode",
		requireTranslator(languageFromParam()),
		getCourseTranslationEditorState,
	)
	router.put(
		"/courses/:idOrSlug/translations/:languageCode",
		requireTranslator(languageFromParam()),
		saveCourseTranslationDraft,
	)

	/**
	 * @openapi
	 * /api/courses/{idOrSlug}/translations/{languageCode}/submit:
	 *   post:
	 *     tags: [Translations]
	 *     summary: Submit a course translation for review
	 *     description: Translator (granted for languageCode) or course-admin only. Moves draft (or stale) to in_review.
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: idOrSlug
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: path
	 *         name: languageCode
	 *         required: true
	 *         schema:
	 *           type: string
	 *           enum: [es, fr, sw]
	 *     responses:
	 *       200:
	 *         description: Submitted for review
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/CourseTranslation'
	 *       400:
	 *         description: No draft or stale translation available to submit
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       403:
	 *         $ref: '#/components/responses/ForbiddenError'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 */
	router.post(
		"/courses/:idOrSlug/translations/:languageCode/submit",
		requireTranslator(languageFromParam()),
		submitCourseTranslationForReview,
	)

	/**
	 * @openapi
	 * /api/courses/{idOrSlug}/translations/{languageCode}/publish:
	 *   post:
	 *     tags: [Translations]
	 *     summary: Publish a course translation
	 *     description: >
	 *       Course-admin only — never a translator, regardless of language
	 *       grant. Moves in_review to published, making it servable to
	 *       learners. This is what guarantees a translator scoped to one
	 *       language can never publish any language, including their own.
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: idOrSlug
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: path
	 *         name: languageCode
	 *         required: true
	 *         schema:
	 *           type: string
	 *           enum: [es, fr, sw]
	 *     responses:
	 *       200:
	 *         description: Published
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/CourseTranslation'
	 *       400:
	 *         description: No in_review translation available to publish
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       403:
	 *         $ref: '#/components/responses/ForbiddenError'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 */
	router.post(
		"/courses/:idOrSlug/translations/:languageCode/publish",
		requireCourseAdmin,
		publishCourseTranslation,
	)

	/**
	 * @openapi
	 * /api/courses/{idOrSlug}/lessons/{orderIndex}/translations/{languageCode}:
	 *   get:
	 *     tags: [Translations]
	 *     summary: Get the lesson translation editor state
	 *     description: >
	 *       Translator (granted for languageCode) or course-admin only. Lesson
	 *       identity is (courseId, orderIndex) — stable across content-version
	 *       edits — not the lesson's row id, which changes on every edit.
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: idOrSlug
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: path
	 *         name: orderIndex
	 *         required: true
	 *         schema:
	 *           type: integer
	 *       - in: path
	 *         name: languageCode
	 *         required: true
	 *         schema:
	 *           type: string
	 *           enum: [es, fr, sw]
	 *     responses:
	 *       200:
	 *         description: Editor state
	 *         content:
	 *           application/json:
	 *             schema:
	 *               type: object
	 *               properties:
	 *                 source:
	 *                   type: object
	 *                   properties:
	 *                     title: { type: string }
	 *                     content: { type: string }
	 *                     sourceVersion: { type: integer }
	 *                 translation:
	 *                   type: object
	 *                   nullable: true
	 *                   allOf:
	 *                     - $ref: '#/components/schemas/LessonTranslation'
	 *                 glossary:
	 *                   type: array
	 *                   items:
	 *                     $ref: '#/components/schemas/GlossaryTerm'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       403:
	 *         $ref: '#/components/responses/ForbiddenError'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 *   put:
	 *     tags: [Translations]
	 *     summary: Save a lesson translation draft
	 *     description: >
	 *       Translator (granted for languageCode) or course-admin only.
	 *       content is stored byte-for-byte — never run through HTML
	 *       sanitization — so headings, fenced code blocks, and links survive
	 *       a save/load round trip untouched.
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: idOrSlug
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: path
	 *         name: orderIndex
	 *         required: true
	 *         schema:
	 *           type: integer
	 *       - in: path
	 *         name: languageCode
	 *         required: true
	 *         schema:
	 *           type: string
	 *           enum: [es, fr, sw]
	 *     requestBody:
	 *       required: true
	 *       content:
	 *         application/json:
	 *           schema:
	 *             type: object
	 *             required: [title, content]
	 *             properties:
	 *               title: { type: string }
	 *               content: { type: string, description: 'Markdown, stored verbatim' }
	 *     responses:
	 *       200:
	 *         description: Saved translation
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/LessonTranslation'
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       403:
	 *         $ref: '#/components/responses/ForbiddenError'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 */
	router.get(
		"/courses/:idOrSlug/lessons/:orderIndex/translations/:languageCode",
		requireTranslator(languageFromParam()),
		getLessonTranslationEditorState,
	)
	router.put(
		"/courses/:idOrSlug/lessons/:orderIndex/translations/:languageCode",
		requireTranslator(languageFromParam()),
		saveLessonTranslationDraft,
	)

	/**
	 * @openapi
	 * /api/courses/{idOrSlug}/lessons/{orderIndex}/translations/{languageCode}/submit:
	 *   post:
	 *     tags: [Translations]
	 *     summary: Submit a lesson translation for review
	 *     description: Translator (granted for languageCode) or course-admin only. Moves draft (or stale) to in_review.
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: idOrSlug
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: path
	 *         name: orderIndex
	 *         required: true
	 *         schema:
	 *           type: integer
	 *       - in: path
	 *         name: languageCode
	 *         required: true
	 *         schema:
	 *           type: string
	 *           enum: [es, fr, sw]
	 *     responses:
	 *       200:
	 *         description: Submitted for review
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/LessonTranslation'
	 *       400:
	 *         description: No draft or stale translation available to submit
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       403:
	 *         $ref: '#/components/responses/ForbiddenError'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 */
	router.post(
		"/courses/:idOrSlug/lessons/:orderIndex/translations/:languageCode/submit",
		requireTranslator(languageFromParam()),
		submitLessonTranslationForReview,
	)

	/**
	 * @openapi
	 * /api/courses/{idOrSlug}/lessons/{orderIndex}/translations/{languageCode}/publish:
	 *   post:
	 *     tags: [Translations]
	 *     summary: Publish a lesson translation
	 *     description: >
	 *       Course-admin only — never a translator, regardless of language
	 *       grant. Moves in_review to published, making it servable to
	 *       learners.
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: path
	 *         name: idOrSlug
	 *         required: true
	 *         schema:
	 *           type: string
	 *       - in: path
	 *         name: orderIndex
	 *         required: true
	 *         schema:
	 *           type: integer
	 *       - in: path
	 *         name: languageCode
	 *         required: true
	 *         schema:
	 *           type: string
	 *           enum: [es, fr, sw]
	 *     responses:
	 *       200:
	 *         description: Published
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/LessonTranslation'
	 *       400:
	 *         description: No in_review translation available to publish
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/ErrorResponse'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       403:
	 *         $ref: '#/components/responses/ForbiddenError'
	 *       404:
	 *         $ref: '#/components/responses/NotFoundError'
	 */
	router.post(
		"/courses/:idOrSlug/lessons/:orderIndex/translations/:languageCode/publish",
		requireCourseAdmin,
		publishLessonTranslation,
	)

	/**
	 * @openapi
	 * /api/translations/queue:
	 *   get:
	 *     tags: [Translations]
	 *     summary: Translator queue for one language
	 *     description: >
	 *       Translator (granted for the requested language) or course-admin
	 *       only. Three buckets: lessons with no translation row yet,
	 *       submissions awaiting publish, and published/draft translations
	 *       flagged stale because their English source changed. This is how a
	 *       translator finds out a lesson they translated has gone stale —
	 *       there is no push notification yet, so checking this queue is the
	 *       supported workflow today.
	 *     security:
	 *       - bearerAuth: []
	 *     parameters:
	 *       - in: query
	 *         name: language
	 *         required: true
	 *         schema:
	 *           type: string
	 *           enum: [es, fr, sw]
	 *     responses:
	 *       200:
	 *         description: Queue contents
	 *         content:
	 *           application/json:
	 *             schema:
	 *               $ref: '#/components/schemas/TranslatorQueue'
	 *       400:
	 *         $ref: '#/components/responses/BadRequestError'
	 *       401:
	 *         $ref: '#/components/responses/UnauthorizedError'
	 *       403:
	 *         $ref: '#/components/responses/ForbiddenError'
	 */
	router.get(
		"/translations/queue",
		requireTranslator(languageFromQuery()),
		getTranslatorQueue,
	)

	return router
}
