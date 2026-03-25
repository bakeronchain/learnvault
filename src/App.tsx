import { Routes, Route, Outlet } from "react-router-dom"
import ComingSoon from "./components/ComingSoon"
import ErrorBoundary from "./components/ErrorBoundary"
import Footer from "./components/Footer"
import NavBar from "./components/NavBar"
import Admin from "./pages/Admin"
import Courses from "./pages/Courses"
import Credential from "./pages/Credential"
import Dao from "./pages/Dao"
import DaoProposals from "./pages/DaoProposals"
import DaoPropose from "./pages/DaoPropose"
import Debug from "./pages/Debug"
import Donor from "./pages/Donor"
import Home from "./pages/Home"
import Leaderboard from "./pages/Leaderboard"
import Learn from "./pages/Learn"
import LessonView from "./pages/LessonView"
import NotFound from "./pages/NotFound"
import Profile from "./pages/Profile"
import ScholarshipApply from "./pages/ScholarshipApply"
import Treasury from "./pages/Treasury"

function App() {
	return (
		<Routes>
			<Route element={<AppLayout />}>
				<Route path="/" element={<Home />} />
				<Route path="/courses" element={<CourseCatalog />} />
				<Route path="/profile" element={<Profile />} />
				<Route path="/profile/:walletAddress" element={<Profile />} />
				<Route path="/debug" element={<Debug />} />
				<Route path="/debug/:contractName" element={<Debug />} />
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
	<div className="min-h-screen flex flex-col pt-24">
		<NavBar />
		<main className="flex-1 relative z-10">
			<Outlet />
		</main>
		<Footer />
	</div>
)

export default App
