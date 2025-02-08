"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const search_controller_1 = require("../controllers/search.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// Search profiles - accessible to both authenticated and unauthenticated users
router.get('/profiles', authMiddleware_1.optionalAuth, search_controller_1.SearchController.searchProfiles);
exports.default = router;
