import { Button, Icon, Layout } from "@stellar/design-system"
import { Routes, Route, Outlet, NavLink } from "react-router-dom"
import styles from "./App.module.css"
import { ComingSoon } from "./components/ComingSoon"
import ConnectAccount from "./components/ConnectAccount"
import CourseCard from "./components/CourseCard"
import ErrorBoundary from "./components/ErrorBoundary"
import Footer from "./components/Footer"
import NavBar from "./components/NavBar"
import { labPrefix } from "./contracts/util"
import Admin from "./pages/Admin"
import Courses from "./pages/Courses"
import Credential from "./pages/Credential"
import Dao from "./pages/Dao"
import DaoProposals from "./pages/DaoProposals"
import DaoPropose from "./pages/DaoPropose"
import Dashboard from "./pages/Dashboard"
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
				<Route path="/courses" element={<Courses />} />
				<Route
					path="/courses/:courseId/lessons/:lessonId"
					element={<LessonView />}
				/>
				<Route path="/learn" element={<Learn />} />
				<Route path="/dao" element={<Dao />} />
				<Route path="/dao/proposals" element={<DaoProposals />} />
				<Route path="/dao/propose" element={<DaoPropose />} />
				<Route path="/leaderboard" element={<Leaderboard />} />
				<Route path="/profile" element={<Profile />} />
				<Route path="/profile/:walletAddress" element={<Profile />} />
				<Route path="/scholarships/apply" element={<ScholarshipApply />} />
				<Route path="/admin" element={<Admin />} />
				<Route path="/treasury" element={<Treasury />} />
				<Route path="/donor" element={<Donor />} />
				<Route path="/credentials/:nftId" element={<Credential />} />
				<Route path="/dashboard" element={<Dashboard />} />
				<Route path="/debug" element={<Debug />} />
				<Route path="/debug/:contractName" element={<Debug />} />
				<Route path="*" element={<NotFound />} />
			</Route>
		</Routes>
	)
}

const AppLayout: React.FC = () => (
	<div className="min-h-screen flex flex-col pt-24 overflow-x-hidden w-full max-w-full">
		<NavBar />
		<main className="flex-1 relative z-10">
			<Outlet />
		</main>
		<Footer />
	</div>
)

export default App
