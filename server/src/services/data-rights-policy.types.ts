export type DeletionPolicy = "erase" | "anonymise"

export interface DataRelation {
	table: string
	identifiers: readonly string[]
	deletion: DeletionPolicy
	description: string
}
