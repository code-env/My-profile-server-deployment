"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequestInfo = void 0;
const ua_parser_js_1 = require("ua-parser-js");
const getRequestInfo = (req) => {
    var _a;
    // Get IP address
    const ip = req.ip ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        ((_a = req.headers['x-forwarded-for']) === null || _a === void 0 ? void 0 : _a.toString().split(',')[0]);
    // Get OS info using user agent
    const parser = new ua_parser_js_1.UAParser(req.headers['user-agent']);
    const os = parser.getOS().name + ' ' + (parser.getOS().version || '');
    console.log(os);
    console.log(ip);
    return { ip, os };
};
exports.getRequestInfo = getRequestInfo;
