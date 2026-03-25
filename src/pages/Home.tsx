import { Button, Card, Icon } from "@stellar/design-system"
import React from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { GuessTheNumber } from "../components/GuessTheNumber"
import { MilestoneTracker } from "../components/MilestoneTracker"
import { labPrefix } from "../contracts/util"
import styles from "./Home.module.css"

const Home: React.FC = () => (
	<div className={styles.Home}>
		<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
			<div>
				<h1>Yay! You&apos;re on Stellar!</h1>

				<p>
					A local development template designed to help you build dApps on the
					Stellar network. This environment lets you easily test wallet
					connections, smart contract interactions, transaction verifications,
					etc.{" "}
					<Link
						to="https://scaffoldstellar.org/docs/intro"
						className="Link Link--primary"
						target="_blank"
					>
						View docs
					</Link>
				</p>

				<div className="mt-8">
					<h2 className="text-xl font-bold mb-4 flex items-center gap-2">
						<Icon.BookOpen01 />
						Course Progress: Stellar Basics
					</h2>
					<MilestoneTracker
						courseId="stellar-basics"
						milestones={[
							{ id: 1, label: "Complete Lesson 1", lrnReward: 10, status: "completed", txHash: "43e8...f2a1" },
							{ id: 2, label: "Pass Quiz 1", lrnReward: 20, status: "in-progress" },
							{ id: 3, label: "Build your first contract", lrnReward: 50, status: "locked" },
						]}
					/>
				</div>
			</div>

			<div className="space-y-8">
				<Card>
					<h2>
						<Icon.File06 size="lg" />
						Sample Contracts
					</h2>

					<p>
						<strong>Guess The Number:</strong> Interact with the sample contract
						from the{" "}
						<Link
							to="https://scaffoldstellar.org/docs/tutorial/overview"
							className="Link Link--primary"
							target="_blank"
						>
							Scaffold Tutorial
						</Link>{" "}
						using an automatically generated contract client.
					</p>

					<GuessTheNumber />

					<p>Or take a look at other sample contracts to get you started:</p>

					<nav>
						<Link to="https://github.com/OpenZeppelin/stellar-contracts/tree/main/examples">
							<Button variant="tertiary" size="md">
								OpenZeppelin sample contracts
								<Icon.ArrowUpRight size="md" />
							</Button>
						</Link>
						<Link to="https://github.com/stellar/soroban-examples">
							<Button variant="tertiary" size="md">
								Soroban sample contracts
								<Icon.ArrowUpRight size="md" />
							</Button>
						</Link>
					</nav>
				</Card>
			</div>
		</div>

				{/* Upstream Content: Sample Contracts */}
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

				{/* Features Cards */}
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
