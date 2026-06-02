import { Routes, Route, Outlet } from "react-router-dom"
import Footer from "./components/Footer"
import NavBar from "./components/NavBar"
import Admin from "./pages/Admin"
import Courses from "./pages/Courses"
import Credential from "./pages/Credential"
import Dao from "./pages/Dao"
import DaoProposals from "./pages/DaoProposals"
import Dashboard from "./pages/Dashboard"

import Debug from "./pages/Debug"
import Home from "./pages/Home"
import Leaderboard from "./pages/Leaderboard"
import Learn from "./pages/Learn"
import NotFound from "./pages/NotFound"
import Profile from "./pages/Profile"
import ScholarshipApply from "./pages/ScholarshipApply"
import Treasury from "./pages/Treasury"

function App() {
	useLocalizeDocumentAttributes()

	return (
		<Routes>
			<Route element={<AppLayout />}>
				<Route path="/" element={<Home />} />
				<Route path="/courses" element={<Courses />} />
				<Route path="/learn" element={<Learn />} />
				<Route path="/dao" element={<Dao />} />
				<Route path="/dao/proposals" element={<DaoProposals />} />
				<Route path="/leaderboard" element={<Leaderboard />} />
				<Route path="/profile" element={<Profile />} />
				<Route path="/scholarships/apply" element={<ScholarshipApply />} />
				<Route path="/admin" element={<Admin />} />
				<Route path="/treasury" element={<Treasury />} />
				<Route path="/credentials/:nftId" element={<Credential />} />
				<Route path="/dashboard" element={<Dashboard />} />

				<Route path="/debug" element={<Debug />} />
				<Route path="/debug/:contractName" element={<Debug />} />
				<Route path="*" element={<NotFound />} />
			</Route>
		</Routes>
	)
}

const RouteFallback = () => (
	<div className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-12">
		<div className="glass-card animate-pulse rounded-[2.5rem] border border-white/5 p-8">
			<div className="mb-6 h-8 w-56 rounded-full bg-white/8" />
			<div className="h-4 w-72 rounded-full bg-white/6" />
			<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 3 }).map((_, index) => (
					<div
						key={index}
						className="h-32 rounded-[1.75rem] border border-white/5 bg-white/5"
					/>
				))}
			</div>
		</div>
	</div>
)

const AppLayout = () => {
	const location = useLocation()
	const shouldReduceMotion = useReducedMotion()

	const pageTransition: MotionProps = shouldReduceMotion
		? {
				initial: false,
				animate: { opacity: 1 },
				exit: { opacity: 1 },
				transition: { duration: 0 },
			}
		: {
				initial: { opacity: 0 },
				animate: { opacity: 1 },
				exit: { opacity: 0 },
				transition: { duration: 0.2, ease: "easeOut" },
			}

	return (
		<div className="min-h-screen flex flex-col pt-24 overflow-x-hidden w-full max-w-full bg-[var(--color-app-bg)] text-[var(--color-app-text)] transition-colors duration-300">
			<NetworkPreconnect />
			<TestnetBanner />
			<NavBar />
			<OnboardingTour />

			<main id="main-content" className="relative z-10 flex-1" tabIndex={-1}>
				<AnimatePresence mode="wait">
					<motion.div key={location.pathname} {...pageTransition}>
						<Outlet />
					</motion.div>
				</AnimatePresence>
			</main>

			<Footer />
		</div>
	)
}

const AppWithProvider = () => (
	<NetworkProvider>
		<App />
	</NetworkProvider>
)

export default AppWithProvider
