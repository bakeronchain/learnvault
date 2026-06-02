import { createContext, use, useCallback, type ReactNode } from "react"
import { toast, Toaster } from "sonner"

const STELLAR_EXPLORER_TX = "https://stellar.expert/explorer/testnet/tx"

interface ToastContextType {
	showSuccess: (message: string, txHash?: string) => void
	showError: (message: string) => void
	showInfo: (message: string) => void
	showWarning: (message: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
	const showSuccess = useCallback((message: string, txHash?: string) => {
		toast.success(message, {
			duration: 5000,
			...(txHash && {
				action: {
					label: "View on Explorer",
					onClick: () =>
						window.open(
							`${STELLAR_EXPLORER_TX}/${txHash}`,
							"_blank",
							"noopener,noreferrer",
						),
				},
			}),
		})
	}, [])

	const showError = useCallback((message: string) => {
		toast.error(message, { duration: 5000 })
	}, [])

	const showInfo = useCallback((message: string) => {
		toast.info(message, { duration: 5000 })
	}, [])

	const showWarning = useCallback((message: string) => {
		toast.warning(message, { duration: 5000 })
	}, [])

	return (
		<ToastContext value={{ showSuccess, showError, showInfo, showWarning }}>
			{children}
			<Toaster position="top-center" richColors closeButton />
		</ToastContext>
	)
}

export function useToast(): ToastContextType {
	const context = use(ToastContext)
	if (!context) {
		throw new Error("useToast must be used within a ToastProvider")
	}
	return context
}
