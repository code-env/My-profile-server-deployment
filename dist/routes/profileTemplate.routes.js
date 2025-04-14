"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const profileTemplate_controller_1 = require("../controllers/profileTemplate.controller");
const router = express_1.default.Router();
router.route('/')
    .post(auth_middleware_1.protect, profileTemplate_controller_1.createTemplate)
    .get(auth_middleware_1.protect, profileTemplate_controller_1.getTemplates);
router.route('/:id')
    .get(auth_middleware_1.protect, profileTemplate_controller_1.getTemplateById)
    .put(auth_middleware_1.protect, profileTemplate_controller_1.updateTemplate)
    .delete(auth_middleware_1.protect, profileTemplate_controller_1.deleteTemplate);
exports.default = router;
