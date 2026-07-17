"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useNotification = void 0;
var react_1 = require("react");
var NotificationProvider_1 = require("../providers/NotificationProvider");
var useNotification = function () {
    var context = (0, react_1.use)(NotificationProvider_1.NotificationContext);
    if (!context) {
        throw new Error("useNotification must be used within a NotificationProvider");
    }
    return context;
};
exports.useNotification = useNotification;
