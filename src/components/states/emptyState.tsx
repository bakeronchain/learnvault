import { type LucideIcon } from "lucide-react"

interface EmptyStateProps {
	icon: LucideIcon
	title: string
	description?: string
}

export function EmptyState({
	icon: Icon,
	title,
	description,
}: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<Icon className="h-12 w-12 text-muted-foreground mb-4" />
			<h3 className="text-lg font-semibold">{title}</h3>
			{description && (
				<p className="text-sm text-muted-foreground mt-1 max-w-sm">
					{description}
				</p>
			)}
		</div>
	)
}
