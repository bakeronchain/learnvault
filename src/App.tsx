import { Button, Icon, Layout } from "@stellar/design-system"
import { Routes, Route, Outlet, NavLink } from "react-router-dom"
import styles from "./App.module.css"
import ComingSoon from "./components/ComingSoon"
import ConnectAccount from "./components/ConnectAccount"
import ErrorBoundary from "./components/ErrorBoundary"
import Footer from "./components/Footer"
import NavBar from "./components/NavBar"
import Admin from "./pages/Admin"
import Courses from "./pages/Courses"
import Credential from "./pages/Credential"
import Dao from "./pages/Dao"
import DaoProposals from "./pages/DaoProposals"
import Debug from "./pages/Debug"
import Donor from "./pages/Donor"
import Home from "./pages/Home"
import Leaderboard from "./pages/Leaderboard"
import Learn from "./pages/Learn"
import NotFound from "./pages/NotFound"
import Profile from "./pages/Profile"
import ScholarshipApply from "./pages/ScholarshipApply"
import Treasury from "./pages/Treasury"

function App() {
	return (
		<Routes>
			<Route element={<AppLayout />}>
				<Route
					path="/"
					element={
						<ErrorBoundary>
							<Home />
						</ErrorBoundary>
					}
				/>
				<Route
					path="/courses"
					element={
						<ErrorBoundary>
							<Courses />
						</ErrorBoundary>
					}
				/>
				<Route
					path="/learn"
					element={
						<ErrorBoundary>
							<Learn />
						</ErrorBoundary>
					}
				/>
				<Route
					path="/dao"
					element={
						<ErrorBoundary>
							<Dao />
						</ErrorBoundary>
					}
				/>
				<Route
					path="/dao/proposals"
					element={
						<ErrorBoundary>
							<DaoProposals />
						</ErrorBoundary>
					}
				/>
				<Route
					path="/leaderboard"
					element={
						<ErrorBoundary>
							<Leaderboard />
						</ErrorBoundary>
					}
				/>
				<Route
					path="/profile"
					element={
						<ErrorBoundary>
							<Profile />
						</ErrorBoundary>
					}
				/>
				<Route
					path="/scholarships/apply"
					element={
						<ErrorBoundary>
							<ScholarshipApply />
						</ErrorBoundary>
					}
				/>
				<Route
					path="/admin"
					element={
						<ErrorBoundary>
							<Admin />
						</ErrorBoundary>
					}
				/>
				<Route
					path="/treasury"
					element={
						<ErrorBoundary>
							<Treasury />
						</ErrorBoundary>
					}
				/>
				<Route
					path="/credentials/:nftId"
					element={
						<ErrorBoundary>
							<Credential />
						</ErrorBoundary>
					}
				/>
				<Route
					path="/dashboard"
					element={
						<ErrorBoundary>
							<ComingSoon title="My Dashboard" />
						</ErrorBoundary>
					}
				/>
				<Route
					path="/debug"
					element={
						<ErrorBoundary>
							<Debug />
						</ErrorBoundary>
					}
				/>
				<Route
					path="/debug/:contractName"
					element={
						<ErrorBoundary>
							<Debug />
						</ErrorBoundary>
					}
				/>
				<Route
					path="*"
					element={
						<ErrorBoundary>
							<NotFound />
						</ErrorBoundary>
					}
				/>
			</Route>
		</Routes>
	)
}

const AppLayout: React.FC = () => (
	<div className={styles.AppLayout}>
		<Layout.Header
			projectId="Scaffold"
			projectTitle="Scaffold"
			hasThemeSwitch={true}
			contentCenter={
				<>
					<NavLink to="/">
						{({ isActive }) => (
							<Button variant="tertiary" size="md" disabled={isActive}>
								<Icon.Home01 size="md" />
								Home
							</Button>
						)}
					</NavLink>
					<NavLink to="/treasury">
						{({ isActive }) => (
							<Button variant="tertiary" size="md" disabled={isActive}>
								<Icon.Coins01 size="md" />
								Treasury
							</Button>
						)}
					</NavLink>
					<NavLink to="/debug">
						{({ isActive }) => (
							<Button variant="tertiary" size="md" disabled={isActive}>
								<Icon.Code02 size="md" />
								Contract Explorer
							</Button>
						)}
					</NavLink>
				</>
			}
			contentRight={<ConnectAccount />}
		/>

		<main>
			<Layout.Content>
				<Layout.Inset>
					<Outlet />
				</Layout.Inset>
			</Layout.Content>
		</main>
		<Footer />
	</div>
)

export default App
