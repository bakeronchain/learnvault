"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_query_1 = require("@tanstack/react-query");
var react_1 = require("react");
var client_1 = require("react-dom/client");
var react_router_dom_1 = require("react-router-dom");
require("@stellar/design-system/build/styles.min.css");
require("./index.css");
var App_tsx_1 = require("./App.tsx");
var NotificationProvider_tsx_1 = require("./providers/NotificationProvider.tsx");
var WalletProvider_tsx_1 = require("./providers/WalletProvider.tsx");
require("./i18n");
var queryClient = new react_query_1.QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: false,
        },
    },
});
(0, client_1.createRoot)(document.getElementById("root")).render(<react_1.StrictMode>
		<NotificationProvider_tsx_1.NotificationProvider>
			<react_query_1.QueryClientProvider client={queryClient}>
				<WalletProvider_tsx_1.WalletProvider>
					<react_router_dom_1.BrowserRouter>
						<App_tsx_1.default />
					</react_router_dom_1.BrowserRouter>
				</WalletProvider_tsx_1.WalletProvider>
			</react_query_1.QueryClientProvider>
		</NotificationProvider_tsx_1.NotificationProvider>
	</react_1.StrictMode>);
