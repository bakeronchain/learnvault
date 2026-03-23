import { Routes, Route, Outlet } from "react-router-dom"
import styles from "./App.module.css"
import Footer from "./components/Footer"
import NavBar from "./components/NavBar"
import Dao from "./pages/Dao"
import Debug from "./pages/Debug"
import Home from "./pages/Home"
import Leaderboard from "./pages/Leaderboard"
import Learn from "./pages/Learn"
import Profile from "./pages/Profile"

function App() {
	return (
		<Routes>
			<Route element={<AppLayout />}>
				<Route path="/" element={<Home />} />
				<Route path="/learn" element={<Learn />} />
				<Route path="/dao" element={<Dao />} />
				<Route path="/leaderboard" element={<Leaderboard />} />
				<Route path="/profile" element={<Profile />} />
				<Route path="/debug" element={<Debug />} />
				<Route path="/debug/:contractName" element={<Debug />} />
			</Route>
		</Routes>
	)
}

const AppLayout: React.FC = () => (
	<div className={styles.AppLayout}>
		<NavBar />
		<main>
			<div style={{ padding: "2rem" }}>
				<Outlet />
			</div>
		</main>
		<Footer />
	</div>
)

export default App
