"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_router_dom_1 = require("react-router-dom");
var ComingSoon_1 = require("./components/ComingSoon");
var Footer_1 = require("./components/Footer");
var NavBar_1 = require("./components/NavBar");
var Admin_1 = require("./pages/Admin");
var Courses_1 = require("./pages/Courses");
var Credential_1 = require("./pages/Credential");
var Dao_1 = require("./pages/Dao");
var DaoProposals_1 = require("./pages/DaoProposals");
var Debug_1 = require("./pages/Debug");
var Home_1 = require("./pages/Home");
var Leaderboard_1 = require("./pages/Leaderboard");
var Learn_1 = require("./pages/Learn");
var NotFound_1 = require("./pages/NotFound");
var Profile_1 = require("./pages/Profile");
var ScholarshipApply_1 = require("./pages/ScholarshipApply");
var Treasury_1 = require("./pages/Treasury");
function App() {
    return (<react_router_dom_1.Routes>
			<react_router_dom_1.Route element={<AppLayout />}>
				<react_router_dom_1.Route path="/" element={<Home_1.default />}/>
				<react_router_dom_1.Route path="/courses" element={<Courses_1.default />}/>
				<react_router_dom_1.Route path="/learn" element={<Learn_1.default />}/>
				<react_router_dom_1.Route path="/dao" element={<Dao_1.default />}/>
				<react_router_dom_1.Route path="/dao/proposals" element={<DaoProposals_1.default />}/>
				<react_router_dom_1.Route path="/leaderboard" element={<Leaderboard_1.default />}/>
				<react_router_dom_1.Route path="/profile" element={<Profile_1.default />}/>
				<react_router_dom_1.Route path="/scholarships/apply" element={<ScholarshipApply_1.default />}/>
				<react_router_dom_1.Route path="/admin" element={<Admin_1.default />}/>
				<react_router_dom_1.Route path="/treasury" element={<Treasury_1.default />}/>
				<react_router_dom_1.Route path="/credentials/:nftId" element={<Credential_1.default />}/>
				<react_router_dom_1.Route path="/dashboard" element={<ComingSoon_1.default title="My Dashboard"/>}/>
				<react_router_dom_1.Route path="/debug" element={<Debug_1.default />}/>
				<react_router_dom_1.Route path="/debug/:contractName" element={<Debug_1.default />}/>
				<react_router_dom_1.Route path="*" element={<NotFound_1.default />}/>
			</react_router_dom_1.Route>
		</react_router_dom_1.Routes>);
}
var AppLayout = function () { return (<div className="min-h-screen flex flex-col pt-24">
		<NavBar_1.default />
		<main className="flex-1 relative z-10">
			<react_router_dom_1.Outlet />
		</main>
		<Footer_1.default />
	</div>); };
exports.default = App;
