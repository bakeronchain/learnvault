type Schema = {
	walletId: string
	walletAddress: string
	walletNetwork: string
	networkPassphrase: string
	walletType: string
	"learnvault:theme": "light" | "dark"
	"learnvault:onboarding-complete": boolean
	"learnvault:onboarding-track": string
}

class TypedStorage<T> {
	private readonly storage: Storage

	constructor() {
		// In some test environments `localStorage` may be a plain object or missing
		// methods. Prefer using the real `localStorage` when it provides the
		// standard Storage API (getItem/setItem/key/removeItem/clear). Otherwise
		// provide a lightweight in-memory replacement that matches the Storage
		// surface so the rest of the code (and unit tests) can rely on it.
		const maybeStorage = (
			typeof globalThis !== "undefined"
				? (globalThis as any).localStorage
				: undefined
		) as Storage | undefined

		if (
			maybeStorage &&
			typeof maybeStorage.getItem === "function" &&
			typeof maybeStorage.setItem === "function" &&
			typeof maybeStorage.key === "function" &&
			typeof maybeStorage.removeItem === "function" &&
			typeof maybeStorage.clear === "function"
		) {
			this.storage = maybeStorage
			return
		}

		// Minimal in-memory Storage implementation used for tests or environments
		// without a proper `localStorage`.
		const mem = (() => {
			const map = new Map<string, string>()
			return {
				getItem(key: string) {
					return map.has(key) ? (map.get(key) as string) : null
				},
				setItem(key: string, value: string) {
					map.set(key, String(value))
				},
				removeItem(key: string) {
					map.delete(key)
				},
				clear() {
					map.clear()
				},
				key(index: number) {
					return Array.from(map.keys())[index] ?? null
				},
				get length() {
					return map.size
				},
			}
		})()

		this.storage = mem as unknown as Storage
	}

	public get length(): number {
		return this.storage.length
	}

	public key<U extends keyof T>(index: number): U | null {
		return this.storage.key(index) as U | null
	}

	public getItem<U extends keyof T>(
		key: U,
		retrievalMode: "fail" | "raw" | "safe" = "fail",
	): T[U] | null {
		const item = this.storage.getItem(String(key))

		if (item == null) {
			return null
		}

		try {
			const parsed = JSON.parse(item)

			if (key === "learnvault:theme") {
				if (parsed === "light" || parsed === "dark") {
					return parsed as T[U]
				}

				if (retrievalMode === "safe") {
					return null
				}

				throw new Error(`Invalid theme value for "${String(key)}"`)
			}

			return parsed as T[U]
		} catch (error) {
			switch (retrievalMode) {
				case "safe":
					return null
				case "raw":
					return item as unknown as T[U]
				default:
					throw new Error(`Failed to parse localStorage key "${String(key)}"`, {
						cause: error,
					})
			}
		}
	}

	public setItem<U extends keyof T>(key: U, value: T[U]): void {
		try {
			this.storage.setItem(String(key), JSON.stringify(value))
		} catch (error) {
			console.error(`Failed to set localStorage key "${String(key)}":`, error)
		}
	}

	public removeItem<U extends keyof T>(key: U): void {
		this.storage.removeItem(String(key))
	}

	public clear(): void {
		this.storage.clear()
	}
}

const storage = new TypedStorage<Schema>()

export default storage
