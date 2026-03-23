import { Button, Card, Icon } from "@stellar/design-system"
import React from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { GuessTheNumber } from "../components/GuessTheNumber"
import { MilestoneTracker } from "../components/MilestoneTracker"
import { labPrefix } from "../contracts/util"
import styles from "./Home.module.css"

const Home: React.FC = () => {
	const { t } = useTranslation()

	const mockMilestones = [
		{ id: 1, label: t("home.milestones.1"), lrnReward: 10 },
		{ id: 2, label: t("home.milestones.2"), lrnReward: 20 },
		{ id: 3, label: t("home.milestones.3"), lrnReward: 50 },
	]

	return (
		<div className={styles.Home}>
			<div>
				<h1>{t("home.heroTitle")}</h1>

				<p>
					{t("home.heroDesc")}
					<Link
						to="https://scaffoldstellar.org/docs/intro"
						className="Link Link--primary"
						target="_blank"
					>
						{t("nav.viewDocs")}
					</Link>
				</p>
			</div>

			<Card>
				<h2>
					<Icon.Trophy01 size="lg" />
					{t("home.courseProgress.title")}
				</h2>
				<p>{t("home.courseProgress.desc")}</p>
				<MilestoneTracker
					courseId="stellar-basics"
					milestones={mockMilestones}
				/>
			</Card>

			<Card>
				<h2>
					<Icon.File06 size="lg" />
					{t("home.sampleContracts.title")}
				</h2>

				<p>
					<strong>{t("home.sampleContracts.guess")}</strong>{" "}
					{t("home.sampleContracts.guessDesc1")}
					<Link
						to="https://scaffoldstellar.org/docs/tutorial/overview"
						className="Link Link--primary"
						target="_blank"
					>
						{t("home.sampleContracts.guessLink")}
					</Link>{" "}
					{t("home.sampleContracts.guessDesc2")}
				</p>

				<GuessTheNumber />

				<p>{t("home.sampleContracts.other")}</p>

				<nav>
					<Link to="https://github.com/OpenZeppelin/stellar-contracts/tree/main/examples">
						<Button variant="tertiary" size="md">
							{t("home.sampleContracts.oz")}
							<Icon.ArrowUpRight size="md" />
						</Button>
					</Link>
					<Link to="https://github.com/stellar/soroban-examples">
						<Button variant="tertiary" size="md">
							{t("home.sampleContracts.soroban")}
							<Icon.ArrowUpRight size="md" />
						</Button>
					</Link>
				</nav>
			</Card>

			<Card>
				<h2>
					<Icon.Code02 size="lg" />
					{t("home.startBuilding.title")}
				</h2>

				<ol>
					<li>
						{t("home.startBuilding.step1")}
						<code>/src/contracts</code>
					</li>
					<li>
						{t("home.startBuilding.step2")}
						<code>npm start</code>
					</li>
					<li>
						{t("home.startBuilding.step3")}
						<code>Vite</code>
					</li>
					<li>{t("home.startBuilding.step4")}</li>
				</ol>

				<p>
					{t("home.startBuilding.watch")}
					<Link
						to="https://www.youtube.com/watch?v=86hWe8Ragtg&list=PLmr3tp_7-7Gjj6gn5-bBn-QTMyaWzwOU5&index=1"
						className="Link Link--primary"
					>
						{t("home.startBuilding.youtube")}
					</Link>
					<br />
					{t("home.startBuilding.inspired")}
					<Link
						to="https://scaffoldstellar.org/showcase"
						className="Link Link--primary"
					>
						{t("home.startBuilding.examples")}
					</Link>
					<br />
					{t("home.startBuilding.deploy")}
					<Link
						to="https://developers.stellar.org/docs/tools/cli/install-cli"
						className="Link Link--primary"
					>
						{t("home.startBuilding.mainnet")}
					</Link>
				</p>
				<p></p>
			</Card>

			<section>
				<Card>
					<Icon.Code02 size="lg" />
					<p>
						{t("home.footer.invoke")}
						<Link to="/debug" className="Link Link--primary">
							{t("home.footer.contractLink")}
						</Link>
					</p>
				</Card>

				<Card>
					<Icon.SearchLg size="lg" />
					<p>
						{t("home.footer.browse")}
						<Link to={labPrefix()} className="Link Link--primary">
							{t("home.footer.txLink")}
						</Link>
					</p>
				</Card>
			</section>
		</div>
	)
}

export default Home
