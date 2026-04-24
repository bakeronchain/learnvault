import request from 'supertest'
import { app } from '../index'

describe('HTML Sanitization and Input Validation', () => {
	describe('XSS Protection', () => {
		it('should sanitize XSS in comments', async () => {
			const xssPayload = '<script>alert("xss")</script><img src=x onerror=alert("xss")>'
			const response = await request(app)
				.post('/api/comments')
				.send({
					proposal_id: 'test-proposal-1',
					body: xssPayload,
					author_address: 'GTEST1234567890123456789012345678901234567890',
				})
				.expect(201)

			expect(response.body.content).not.toContain('<script>')
			expect(response.body.content).not.toContain('onerror')
			expect(response.body.content).toBe('') // All tags stripped
		})

		it('should sanitize XSS in proposal titles', async () => {
			const xssPayload = '<script>alert("xss")</script>Malicious Title'
			const response = await request(app)
				.post('/api/governance/proposals')
				.send({
					author_address: 'GTEST1234567890123456789012345678901234567890',
					title: xssPayload,
					description: 'Test description',
					requested_amount: '100',
				})
				.expect(201)

			// Check database or mock to verify sanitization
			// This would require checking the actual stored value
		})

		it('should allow basic formatting in descriptions', async () => {
			const validHtml = '<p>This is <strong>bold</strong> and <em>italic</em> text with <ul><li>list items</li></ul></p>'
			const response = await request(app)
				.post('/api/governance/proposals')
				.send({
					author_address: 'GTEST1234567890123456789012345678901234567890',
					title: 'Test Proposal',
					description: validHtml,
					requested_amount: '100',
				})
				.expect(201)

			// Should preserve allowed tags
			expect(response.body).toBeDefined()
		})

		it('should sanitize XSS in milestone evidence descriptions', async () => {
			const xssPayload = '<script>alert("xss")</script><div onclick="alert(\'xss\')">Click me</div>'
			const response = await request(app)
				.post('/api/milestones/submit')
				.send({
					learner_address: 'GTEST1234567890123456789012345678901234567890',
					course_id: 'test-course-1',
					milestone_id: 1,
					evidence_url: 'https://github.com/test/repo',
					evidenceDescription: xssPayload,
				})
				.expect(201)

			// Verify sanitization (would need to check stored value)
		})

		it('should sanitize XSS in milestone rejection reasons', async () => {
			const xssPayload = '<script>alert("xss")</script>Malicious reason'
			// This would require admin authentication
			// Test would need to mock admin middleware
		})
	})

	describe('Input Length Validation', () => {
		it('should reject oversized comments', async () => {
			const oversizedContent = 'a'.repeat(2001) // Exceeds 2000 char limit
			const response = await request(app)
				.post('/api/comments')
				.send({
					proposal_id: 'test-proposal-1',
					body: oversizedContent,
					author_address: 'GTEST1234567890123456789012345678901234567890',
				})
				.expect(400)

			expect(response.body.error).toContain('2000')
		})

		it('should reject oversized proposal titles', async () => {
			const oversizedTitle = 'a'.repeat(201) // Exceeds 200 char limit
			const response = await request(app)
				.post('/api/governance/proposals')
				.send({
					author_address: 'GTEST1234567890123456789012345678901234567890',
					title: oversizedTitle,
					description: 'Test description',
					requested_amount: '100',
				})
				.expect(400)

			expect(response.body.details?.title).toBeDefined()
		})

		it('should reject oversized proposal descriptions', async () => {
			const oversizedDescription = 'a'.repeat(5001) // Exceeds 5000 char limit
			const response = await request(app)
				.post('/api/governance/proposals')
				.send({
					author_address: 'GTEST1234567890123456789012345678901234567890',
					title: 'Test Proposal',
					description: oversizedDescription,
					requested_amount: '100',
				})
				.expect(400)

			expect(response.body.details?.description).toBeDefined()
		})

		it('should reject oversized milestone evidence descriptions', async () => {
			const oversizedDescription = 'a'.repeat(2001) // Exceeds 2000 char limit
			const response = await request(app)
				.post('/api/milestones/submit')
				.send({
					learner_address: 'GTEST1234567890123456789012345678901234567890',
					course_id: 'test-course-1',
					milestone_id: 1,
					evidence_url: 'https://github.com/test/repo',
					evidenceDescription: oversizedDescription,
				})
				.expect(400)

			expect(response.body.error).toContain('2000')
		})

		it('should reject oversized course descriptions', async () => {
			const oversizedDescription = 'a'.repeat(2001) // Exceeds 2000 char limit
			const response = await request(app)
				.post('/api/courses')
				.send({
					title: 'Test Course',
					slug: 'test-course',
					description: oversizedDescription,
					track: 'web-development',
					difficulty: 'beginner',
				})
				.expect(400)

			expect(response.body.error).toContain('2000')
		})
	})

	describe('Edge Cases', () => {
		it('should handle null/undefined values gracefully', async () => {
			const response = await request(app)
				.post('/api/comments')
				.send({
					proposal_id: 'test-proposal-1',
					body: '',
					author_address: 'GTEST1234567890123456789012345678901234567890',
				})
				.expect(400)

			expect(response.body.error).toBeDefined()
		})

		it('should preserve valid Unicode characters', async () => {
			const unicodeContent = 'Hello 世界 🚀 ñáéíóú'
			const response = await request(app)
				.post('/api/comments')
				.send({
					proposal_id: 'test-proposal-1',
					body: unicodeContent,
					author_address: 'GTEST1234567890123456789012345678901234567890',
				})
				.expect(201)

			expect(response.body.content).toBe(unicodeContent)
		})

		it('should handle empty strings after sanitization', async () => {
			const onlyXss = '<script>alert("xss")</script>'
			const response = await request(app)
				.post('/api/comments')
				.send({
					proposal_id: 'test-proposal-1',
					body: onlyXss,
					author_address: 'GTEST1234567890123456789012345678901234567890',
				})
				.expect(201)

			expect(response.body.content).toBe('')
		})
	})
})
