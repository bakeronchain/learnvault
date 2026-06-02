import React from "react"
import { Helmet } from "react-helmet"
import { FAQSection } from "../components/FAQSection"

const FAQPage: React.FC = () => {
	const siteUrl = "https://learnvault.app"
	const title = "Help Center & FAQ — LearnVault Docs"
	const description =
		"Find answers to frequently asked questions about Soroban smart contracts, Web3 Stellar wallets, and IPFS client-side file encryption."

	return (
		<>
			<Helmet>
				<title>{title}</title>
				<meta name="description" content={description} />
				<meta property="og:title" content={title} />
				<meta property="og:description" content={description} />
				<meta property="og:image" content={`${siteUrl}/og-image.png`} />
				<meta property="og:url" content={`${siteUrl}/faq`} />
				<meta name="twitter:card" content="summary_large_image" />
			</Helmet>

			{/* Background ambient mesh glows */}
			<div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
				<div className="absolute top-0 left-1/4 w-[700px] h-[700px] bg-brand-cyan/10 blur-[160px] rounded-full" />
				<div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-brand-purple/10 blur-[160px] rounded-full" />
			</div>

			<div className="w-full min-h-[70vh] flex items-center justify-center py-12">
				<FAQSection />
			</div>
		</>
	)
}

export default FAQPage
