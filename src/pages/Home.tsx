import { Button, Icon } from "@stellar/design-system"
import React from "react"
import { Helmet } from "react-helmet"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { GuessTheNumber } from "../components/GuessTheNumber"
import { MilestoneTracker } from "../components/MilestoneTracker"
import OnboardingWizard from "../components/OnboardingWizard"
import { WalletAddressPill } from "../components/WalletAddressPill"

const Home: React.FC = () => {
	const { t } = useTranslation()

	const mockMilestones = [
		{ id: 1, label: t("home.milestones.1"), lrnReward: 10 },
		{ id: 2, label: t("home.milestones.2"), lrnReward: 20 },
		{ id: 3, label: t("home.milestones.3"), lrnReward: 50 },
	]

	const siteUrl = "https://learnvault.app"
	const title = "LearnVault — Learn Stellar & Soroban Development"
	const description =
		"Master Stellar blockchain and Soroban smart contract development. Earn ScholarNFTs, unlock LRN rewards, and join a community-governed learning DAO."

	return (
		<>
			<Helmet>
				<title>{title}</title>
				<meta property="og:title" content={title} />
				<meta property="og:description" content={description} />
				<meta property="og:image" content={`${siteUrl}/og-image.png`} />
				<meta property="og:url" content={siteUrl} />
				<meta name="twitter:card" content="summary_large_image" />
			</Helmet>

			<div className="min-h-screen flex flex-col items-center py-20 px-6 relative overflow-hidden">
				<div className="absolute top-0 left-0 w-full h-full animate-mesh opacity-30 -z-20" />
				<div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-brand-cyan/20 blur-[150px] rounded-full -z-10 animate-pulse" />
				<div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-brand-purple/20 blur-[150px] rounded-full -z-10 animate-pulse delay-700" />

				<OnboardingWizard />

				<header className="text-center max-w-4xl mx-auto mb-24">
					<div className="inline-block mb-10 animate-in fade-in zoom-in duration-1000">
						<div className="w-24 h-24 bg-linear-to-br from-brand-cyan to-brand-blue rounded-[2.5rem] flex items-center justify-center font-black text-3xl shadow-2xl shadow-brand-cyan/30 rotate-12 hover:rotate-0 transition-transform duration-500">
							LV
						</div>
					</div>

					<h1 className="text-7xl md:text-8xl font-black mb-8 tracking-tighter text-gradient leading-[0.9] animate-in slide-in-from-bottom-12 duration-1000 delay-200">
						{t("home.heroTitle")}
					</h1>
					<p className="text-xl md:text-2xl text-white/50 mb-12 max-w-2xl mx-auto font-medium leading-relaxed animate-in slide-in-from-bottom-12 duration-1000 delay-400">
						{t("home.heroDesc")}
					</p>
					<div className="flex flex-wrap justify-center gap-6 animate-in slide-in-from-bottom-12 duration-1000 delay-600">
						<Link
							to="/courses"
							className="iridescent-border px-12 py-5 rounded-2xl font-black text-lg uppercase tracking-widest hover:scale-105 active:scale-95 transition-all group relative overflow-hidden shadow-2xl shadow-brand-cyan/20"
						>
							<span className="relative z-10">{t("nav.courses")}</span>
						</Link>
						<Link
							to="/learn"
							className="px-12 py-5 glass text-white rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-white/10 hover:scale-105 active:scale-95 transition-all border border-white/10"
						>
							{t("nav.learn")}
						</Link>
					</div>
				</header>

				<div className="flex justify-center mb-8">
					<WalletAddressPill address="GABC1234567890ABCDEFGHWXYZ" showLink />
				</div>

				<main className="w-full max-w-6xl flex flex-col gap-12 relative z-10 animate-in slide-in-from-bottom-12 duration-1000 delay-800">
					<div className="iridescent-border p-[1px] rounded-[3.5rem] shadow-2xl">
						<div className="glass-card p-12 rounded-[3.5rem] border border-white/5">
							<div className="flex flex-col md:flex-row gap-12 items-start">
								<div className="md:w-1/3">
									<h2 className="text-3xl font-black mb-4 flex items-center gap-4">
										<Icon.Trophy01 size="lg" className="text-brand-cyan" />
										{t("home.courseProgress.title")}
									</h2>
									<p className="text-white/40 leading-relaxed">
										{t("home.courseProgress.desc")}
									</p>
								</div>
								<div className="md:w-2/3 w-full">
									<MilestoneTracker
										courseId="stellar-basics"
										milestones={mockMilestones}
									/>
								</div>
							</div>
						</div>
					</div>

					<div className="glass-card p-12 rounded-[3.5rem] border border-white/10 shadow-2xl">
						<h2 className="text-3xl font-black mb-10 flex items-center gap-4">
							<Icon.File06 size="lg" className="text-brand-purple" />
							{t("home.sampleContracts.title")}
						</h2>

						<div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
							<div className="space-y-8">
								<p className="text-lg">
									<strong className="text-brand-cyan">
										{t("home.sampleContracts.guess")}
									</strong>{" "}
									<span className="text-white/60">
										{t("home.sampleContracts.guessDesc1")}
									</span>
									<Link
										to="https://github.com/bakeronchain/learnvault#readme"
										className="text-brand-cyan hover:underline ml-2"
										target="_blank"
									>
										{t("home.sampleContracts.guessLink")}
									</Link>{" "}
									{t("home.sampleContracts.guessDesc2")}
								</p>
								<GuessTheNumber />
							</div>

							<div className="space-y-10 flex flex-col justify-center border-l border-white/10 pl-12">
								<p className="text-white/40 leading-relaxed italic">
									{t("home.sampleContracts.other")}
								</p>
								<div className="flex flex-wrap gap-4">
									<Link
										to="https://github.com/OpenZeppelin/stellar-contracts/tree/main/examples"
										target="_blank"
									>
										<Button variant="tertiary" size="md">
											{t("home.sampleContracts.oz")}
											<Icon.ArrowUpRight size="md" />
										</Button>
									</Link>
									<Link
										to="https://github.com/stellar/soroban-examples"
										target="_blank"
									>
										<Button variant="tertiary" size="md">
											{t("home.sampleContracts.soroban")}
											<Icon.ArrowUpRight size="md" />
										</Button>
									</Link>
								</div>
							</div>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						<FeatureCard
							icon="🎓"
							title="ScholarNFTs"
							description="Your hard-earned expertise, permanently immortalized as verifiable credentials on the Stellar network."
						/>
						<FeatureCard
							icon="💰"
							title="Automated Funding"
							description="Decentralized treasury disbursements triggered instantly upon milestone completion via Soroban contracts."
						/>
						<FeatureCard
							icon="🏛"
							title="Community DAO"
							description="A protocol governed by the scholars who use it. Vote on curriculum, treasury, and reputation standards."
						/>
					</div>
				</main>
			</div>
		</>
	)
}

const FeatureCard: React.FC<{
	icon: string
	title: string
	description: string
}> = ({ icon, title, description }) => (
	<div className="glass-card p-10 rounded-[3rem] hover:border-white/20 transition-all hover:-translate-y-4 group">
		<div className="text-4xl mb-6 group-hover:scale-125 transition-transform duration-500">
			{icon}
		</div>
		<h3 className="text-2xl font-black mb-4 tracking-tight">{title}</h3>
		<p className="text-white/40 leading-relaxed font-medium">{description}</p>
	</div>
)

export default Home
