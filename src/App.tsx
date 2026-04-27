import { lazy, Suspense, type ReactNode } from "react"
import { Outlet, Route, Routes } from "react-router-dom"
import ErrorBoundary from "./components/ErrorBoundary"
import Footer from "./components/Footer"
import NavBar from "./components/NavBar"
import NetworkPreconnect from "./components/NetworkPreconnect"
import TestnetBanner from "./components/TestnetBanner"
import { ToastProvider } from "./components/Toast/ToastProvider"
import { WalletToastWatcher } from "./components/WalletToastWatcher"
import { useLocalizeDocumentAttributes } from "./hooks/useLocalizeDocumentAttributes"
import { NetworkProvider } from "./providers/NetworkProvider"

const Admin = lazy(() => import("./pages/Admin"))
const Community = lazy(() => import("./pages/Community"))
const Courses = lazy(() => import("./pages/Courses"))
const Credential = lazy(() => import("./pages/Credential"))
const Dao = lazy(() => import("./pages/Dao"))
const DaoProposals = lazy(() => import("./pages/DaoProposals"))
const DaoPropose = lazy(() => import("./pages/DaoPropose"))
const Dashboard = lazy(() => import("./pages/Dashboard"))
const Debug = lazy(() => import("./pages/Debug"))
const Donor = lazy(() => import("./pages/Donor"))
const Home = lazy(() => import("./pages/Home"))
const History = lazy(() => import("./pages/History"))
const Leaderboard = lazy(() => import("./pages/Leaderboard"))
const Learn = lazy(() => import("./pages/Learn"))
const LessonView = lazy(() => import("./pages/LessonView"))
const NotFound = lazy(() => import("./pages/NotFound"))
const PeerReview = lazy(() => import("./pages/PeerReview"))
const Profile = lazy(() => import("./pages/Profile"))
const ScholarshipApply = lazy(() => import("./pages/ScholarshipApply"))
const Treasury = lazy(() => import("./pages/Treasury"))
const Wiki = lazy(() => import("./pages/Wiki"))
const WikiPage = lazy(() => import("./pages/WikiPage"))

const renderRoute = (element: ReactNode) => (
	<ErrorBoundary>
		<Suspense fallback={<RouteFallback />}>{element}</Suspense>
	</ErrorBoundary>
)

function App() {
	useLocalizeDocumentAttributes()

	return (
		<ToastProvider>
			<WalletToastWatcher />
			<Routes>
				<Route element={<AppLayout />}>
					<Route path="/" element={renderRoute(<Home />)} />
					<Route path="/courses" element={renderRoute(<Courses />)} />
					<Route
						path="/courses/:courseId/lessons/:lessonId"
						element={renderRoute(<LessonView />)}
					/>
					<Route path="/learn" element={renderRoute(<Learn />)} />
					<Route path="/dao" element={renderRoute(<Dao />)} />
					<Route
						path="/dao/proposals"
						element={renderRoute(<DaoProposals />)}
					/>
					<Route path="/dao/propose" element={renderRoute(<DaoPropose />)} />
					<Route path="/leaderboard" element={renderRoute(<Leaderboard />)} />
					<Route path="/peer-review" element={renderRoute(<PeerReview />)} />
					<Route path="/community" element={renderRoute(<Community />)} />
					<Route path="/history" element={renderRoute(<History />)} />
					<Route path="/profile" element={renderRoute(<Profile />)} />
					<Route
						path="/profile/:walletAddress"
						element={renderRoute(<Profile />)}
					/>
					<Route
						path="/scholarships/apply"
						element={renderRoute(<ScholarshipApply />)}
					/>
					<Route path="/admin" element={renderRoute(<Admin />)} />
					<Route path="/wiki" element={renderRoute(<Wiki />)} />
					<Route path="/wiki/:slug" element={renderRoute(<WikiPage />)} />
					<Route path="/treasury" element={renderRoute(<Treasury />)} />
					<Route path="/donor" element={renderRoute(<Donor />)} />
					<Route
						path="/credentials/:id"
						element={renderRoute(<Credential />)}
					/>
					<Route path="/dashboard" element={renderRoute(<Dashboard />)} />
					<Route path="/debug" element={renderRoute(<Debug />)} />
					<Route path="/debug/:contractName" element={renderRoute(<Debug />)} />
					<Route path="*" element={renderRoute(<NotFound />)} />
				</Route>
			</Routes>
		</ToastProvider>
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

const AppLayout = () => (
	// Issue #61 — Theme-aware background using CSS variables + Tailwind dark: variant
	<div className="min-h-screen flex flex-col pt-24 overflow-x-hidden w-full max-w-full bg-[var(--color-app-bg)] text-[var(--color-app-text)] transition-colors duration-300">
		<NetworkPreconnect />
		<TestnetBanner />
		<NavBar />
		<main id="main-content" className="flex-1 relative z-10" tabIndex={-1}>
			<Outlet />
		</main>
		<Footer />
	</div>
)

const AppWithProvider = () => (
	<NetworkProvider>
		<App />
	</NetworkProvider>
)

export default AppWithProvider
