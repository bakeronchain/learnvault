import { type Request, type Response } from "express"
import { AppError } from "../errors/app-error-handler"
import { type AuthRequest } from "../middleware/auth.middleware"
import {
	createProviderKey,
	listProviderKeys,
	revokeProviderKey,
	updateProviderKey,
} from "../services/provider-keys.service"

const ALLOWED_SCOPES = [
	"courses:write",
	"completions:write",
	"lrn:read",
	"webhooks:write",
]

export const createKey = async (
	req: AuthRequest,
	res: Response,
): Promise<void> => {
	const { provider_name, scopes, rate_limit_per_minute } = req.body as {
		provider_name?: string
		scopes?: string[]
		rate_limit_per_minute?: number
	}

	if (!provider_name || typeof provider_name !== "string") {
		throw new AppError("provider_name is required", 400)
	}

	const scopeList: string[] = Array.isArray(scopes) ? scopes : ALLOWED_SCOPES
	const invalid = scopeList.filter((s) => !ALLOWED_SCOPES.includes(s))
	if (invalid.length > 0) {
		throw new AppError(
			`Invalid scopes: ${invalid.join(", ")}. Allowed: ${ALLOWED_SCOPES.join(", ")}`,
			400,
		)
	}

	const rateLimit =
		typeof rate_limit_per_minute === "number" && rate_limit_per_minute > 0
			? Math.min(rate_limit_per_minute, 1000)
			: 60

	const { rawKey, record } = await createProviderKey({
		providerName: provider_name,
		scopes: scopeList,
		rateLimitPerMinute: rateLimit,
		createdBy: req.walletAddress ?? "unknown",
	})

	// rawKey is returned once — it cannot be recovered later
	res.status(201).json({ data: { ...record, api_key: rawKey } })
}

export const listKeys = async (_req: Request, res: Response): Promise<void> => {
	const keys = await listProviderKeys()
	res.json({ data: keys })
}

export const revokeKey = async (
	req: AuthRequest,
	res: Response,
): Promise<void> => {
	const id = parseInt(req.params.id, 10)
	if (isNaN(id)) throw new AppError("Invalid key id", 400)

	const ok = await revokeProviderKey(id, req.walletAddress ?? "unknown")
	if (!ok) throw new AppError("Provider key not found or already revoked", 404)

	res.status(204).send()
}

export const patchKey = async (req: Request, res: Response): Promise<void> => {
	const id = parseInt(req.params.id, 10)
	if (isNaN(id)) throw new AppError("Invalid key id", 400)

	const { scopes, rate_limit_per_minute } = req.body as {
		scopes?: string[]
		rate_limit_per_minute?: number
	}

	if (scopes !== undefined) {
		const invalid = scopes.filter((s) => !ALLOWED_SCOPES.includes(s))
		if (invalid.length > 0) {
			throw new AppError(
				`Invalid scopes: ${invalid.join(", ")}. Allowed: ${ALLOWED_SCOPES.join(", ")}`,
				400,
			)
		}
	}

	const updated = await updateProviderKey(id, {
		scopes,
		rateLimitPerMinute:
			typeof rate_limit_per_minute === "number"
				? Math.min(rate_limit_per_minute, 1000)
				: undefined,
	})

	if (!updated) throw new AppError("Provider key not found", 404)

	res.json({ data: updated })
}
