import React from "react"
import { Helmet } from "react-helmet"
import { SponsorCheckout } from "../components/sponsor/SponsorCheckout"

const SponsorCheckoutPage: React.FC = () => {
	const siteUrl = "https://learnvault.app"
	const title = "Sponsor Student Licenses — LearnVault Gateway"
	const description =
		"Fund education access licenses in bulk and credit them directly to student wallet addresses. Real-time gas estimator included."

	return (
		<>
			<Helmet>
				<title>{title}</title>
				<meta name="description" content={description} />
				<meta property="og:title" content={title} />
				<meta property="og:description" content={description} />
				<meta property="og:image" content={`${siteUrl}/og-image.png`} />
				<meta property="og:url" content={`${siteUrl}/sponsor/checkout`} />
				<meta name="twitter:card" content="summary_large_image" />
			</Helmet>

			{/* Background glows */}
			<div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
				<div className="absolute top-0 left-1/4 w-[700px] h-[700px] bg-brand-cyan/10 blur-[160px] rounded-full" />
				<div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-brand-purple/10 blur-[160px] rounded-full" />
			</div>

			<div className="w-full min-h-[70vh] flex items-center justify-center py-12">
				<SponsorCheckout />
			</div>
		</>
	)
}

export default SponsorCheckoutPage
