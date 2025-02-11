"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const logs_controller_1 = require("../controllers/logs.controller");
const router = (0, express_1.Router)();
// Get log file contents with pagination
router.get('/files/:filename', logs_controller_1.getLogFile);
// Delete/clear log file
router.delete('/files/:filename', logs_controller_1.deleteLogFile);
exports.default = router;
