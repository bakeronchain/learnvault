"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationContext = exports.NotificationProvider = void 0;
var design_system_1 = require("@stellar/design-system");
var react_1 = require("react");
require("./NotificationProvider.css"); // Import CSS for sliding effect
var NotificationContext = (0, react_1.createContext)(undefined);
exports.NotificationContext = NotificationContext;
var NotificationProvider = function (_a) {
    var children = _a.children;
    var _b = (0, react_1.useState)([]), notifications = _b[0], setNotifications = _b[1];
    var addNotification = (0, react_1.useCallback)(function (message, type) {
        var newNotification = {
            id: "".concat(type, "-").concat(Date.now().toString()),
            message: message,
            type: type,
            isVisible: true,
        };
        setNotifications(function (prev) { return __spreadArray(__spreadArray([], prev, true), [newNotification], false); });
        setTimeout(function () {
            setNotifications(markRead(newNotification.id));
        }, 2500); // Start transition out after 2.5 seconds
        setTimeout(function () {
            setNotifications(filterOut(newNotification.id));
        }, 5000); // Remove after 5 seconds
    }, []);
    var contextValue = (0, react_1.useMemo)(function () { return ({ addNotification: addNotification }); }, [addNotification]);
    return (<NotificationContext value={contextValue}>
			{children}
			<div className="notification-container">
				{notifications.map(function (notification) { return (<div key={notification.id} className={"notification ".concat(notification.isVisible ? "slide-in" : "slide-out")}>
						<design_system_1.Notification title={notification.message} variant={notification.type}/>
					</div>); })}
			</div>
		</NotificationContext>);
};
exports.NotificationProvider = NotificationProvider;
function markRead(id) {
    return function (prev) {
        return prev.map(function (notification) {
            return notification.id === id
                ? __assign(__assign({}, notification), { isVisible: true }) : notification;
        });
    };
}
function filterOut(id) {
    return function (prev) { return prev.filter(function (notification) { return notification.id !== id; }); };
}
