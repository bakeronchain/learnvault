"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var design_system_1 = require("@stellar/design-system");
var react_router_dom_1 = require("react-router-dom");
var NotFound_module_css_1 = require("./NotFound.module.css");
var NotFound = function () {
    return (<div className={NotFound_module_css_1.default.NotFound}>
			<design_system_1.Icon.SearchLg size="xl"/>
			<h1>404</h1>
			<design_system_1.Text as="p" size="md">
				This page doesn't exist — but your learning journey does.
			</design_system_1.Text>
			<react_router_dom_1.Link to="/" aria-label="Go back to homepage">
				<design_system_1.Button size="md" variant="primary">
					Go Home
				</design_system_1.Button>
			</react_router_dom_1.Link>
		</div>);
};
exports.default = NotFound;
