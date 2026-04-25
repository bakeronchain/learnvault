import React, { useId } from "react"
import { useTranslation } from "react-i18next"

export const LanguageSelector: React.FC = () => {
	const { i18n } = useTranslation()
	const selectId = useId()

	const handleLanguageChange = (
		event: React.ChangeEvent<HTMLSelectElement>,
	) => {
		void i18n.changeLanguage(event.target.value)
	}

	return (
		<div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
			<label
				htmlFor={selectId}
				style={{
					fontSize: "0.9rem",
					fontWeight: 600,
					color: "white",
				}}
			>
				Language
			</label>
			<select
				id={selectId}
				value={i18n.language || "en"}
				onChange={handleLanguageChange}
				aria-label="Select language"
				style={{
					padding: "6px 10px",
					borderRadius: "8px",
					background: "rgba(5, 7, 10, 0.75)",
					color: "#ffffff",
					border: "1px solid rgba(255, 255, 255, 0.2)",
					cursor: "pointer",
					fontSize: "0.9rem",
					outline: "none",
				}}
			>
				<option value="en" style={{ color: "#000" }}>
					🇺🇸 English
				</option>
				<option value="es" style={{ color: "#000" }}>
					🇪🇸 Español
				</option>
				<option value="fr" style={{ color: "#000" }}>
					🇫🇷 Français
				</option>
				<option value="sw" style={{ color: "#000" }}>
					🇰🇪 Kiswahili
				</option>
			</select>
		</div>
	)
}
