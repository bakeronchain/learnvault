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
		this.storage = localStorage
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
