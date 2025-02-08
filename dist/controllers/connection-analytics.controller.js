"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionAnalyticsController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const connection_analytics_service_1 = require("../services/connection-analytics.service");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
class ConnectionAnalyticsController {
    /**
     * Get connection strength
     * @route GET /api/connections/analytics/strength/:connectionId
     */
    static async getConnectionStrength(req, res) {
        try {
            const user = req.user;
            const { connectionId } = req.params;
            const userId = user === null || user === void 0 ? void 0 : user._id;
            if (!userId) {
                throw new errors_1.CustomError('MISSING_TOKEN', 'User not authenticated');
            }
            const strength = await connection_analytics_service_1.ConnectionAnalyticsService.calculateConnectionStrength(new mongoose_1.default.Types.ObjectId(userId), new mongoose_1.default.Types.ObjectId(connectionId));
            res.json({
                success: true,
                data: {
                    strength,
                    summary: {
                        score: strength.score,
                        level: this.getStrengthLevel(strength.score),
                        strongPoints: strength.metadata.strongestFactors,
                        suggestions: strength.metadata.suggestedActions
                    }
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error in getConnectionStrength:', error);
            res.status(error instanceof errors_1.CustomError ? 400 : 500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to get connection strength'
            });
        }
    }
    /**
     * Get connection strength history
     * @route GET /api/connections/analytics/history/:connectionId
     */
    static async getStrengthHistory(req, res) {
        try {
            const user = req.user;
            const { connectionId } = req.params;
            const { period = 'month' } = req.query;
            const userId = user === null || user === void 0 ? void 0 : user._id;
            if (!userId) {
                throw new errors_1.CustomError('MISSING_TOKEN', 'User not authenticated');
            }
            const history = await connection_analytics_service_1.ConnectionAnalyticsService.getConnectionStrengthHistory(new mongoose_1.default.Types.ObjectId(userId), new mongoose_1.default.Types.ObjectId(connectionId), period);
            res.json({
                success: true,
                data: history
            });
        }
        catch (error) {
            logger_1.logger.error('Error in getStrengthHistory:', error);
            res.status(error instanceof errors_1.CustomError ? 400 : 500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to get connection history'
            });
        }
    }
    /**
     * Get strength level label based on score
     */
    static getStrengthLevel(score) {
        if (score >= 0.8)
            return 'Very Strong';
        if (score >= 0.6)
            return 'Strong';
        if (score >= 0.4)
            return 'Moderate';
        if (score >= 0.2)
            return 'Weak';
        return 'Very Weak';
    }
}
exports.ConnectionAnalyticsController = ConnectionAnalyticsController;
