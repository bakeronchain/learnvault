import { Routes, Route, Outlet } from "react-router-dom"
import Footer from "./components/Footer"
import NavBar from "./components/NavBar"
import Admin from "./pages/Admin"
import Community from "./pages/Community"
import Credential from "./pages/Credential"
import Dao from "./pages/Dao"
import Debug from "./pages/Debug"
import Home from "./pages/Home"
import Leaderboard from "./pages/Leaderboard"
import Learn from "./pages/Learn"
import Profile from "./pages/Profile"
import Treasury from "./pages/Treasury"

function App() {
	return (
		<Routes>
			<Route element={<AppLayout />}>
				<Route path="/" element={<Home />} />
				<Route path="/learn" element={<Learn />} />
				<Route path="/dao" element={<Dao />} />
				<Route path="/leaderboard" element={<Leaderboard />} />
				<Route path="/profile" element={<Profile />} />
				<Route path="/community" element={<Community />} />
				<Route path="/admin" element={<Admin />} />
				<Route path="/treasury" element={<Treasury />} />
				<Route path="/credentials/:nftId" element={<Credential />} />
				<Route path="/debug" element={<Debug />} />
				<Route path="/debug/:contractName" element={<Debug />} />
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
