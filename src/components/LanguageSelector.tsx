import React from "react"
import { useTranslation } from "react-i18next"

export const LanguageSelector: React.FC = () => {
	const { i18n } = useTranslation()

	const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		void i18n.changeLanguage(e.target.value)
	}

	return (
		<select
			value={i18n.language || "en"}
			onChange={handleLanguageChange}
			style={{
				padding: "6px 10px",
				borderRadius: "8px",
				background: "rgba(255, 255, 255, 0.1)",
				color: "#f3f4f6",
				border: "1px solid rgba(255, 255, 255, 0.2)",
				cursor: "pointer",
				fontSize: "0.9rem",
				outline: "none",
			}}
		>
			<option value="en" style={{ color: "#000" }}>
				English
			</option>
			<option value="fr" style={{ color: "#000" }}>
				Français
			</option>
			<option value="sw" style={{ color: "#000" }}>
				Kiswahili
			</option>
		</select>
	)
}
