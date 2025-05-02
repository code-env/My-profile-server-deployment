"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsController = void 0;
const my_pts_model_1 = require("../models/my-pts.model");
const my_pts_value_model_1 = require("../models/my-pts-value.model");
const logger_1 = require("../utils/logger");
exports.analyticsController = {
    async getDashboardAnalytics(req, res) {
        try {
            const user = req.user;
            const timeframe = req.query.timeframe || 'month';
            const currency = String(req.query.currency || 'USD');
            const userId = (user === null || user === void 0 ? void 0 : user._id) || (user === null || user === void 0 ? void 0 : user.id);
            // Calculate date range based on timeframe
            const now = new Date();
            let startDate = new Date();
            switch (timeframe) {
                case 'day':
                    startDate.setDate(now.getDate() - 1);
                    break;
                case 'week':
                    startDate.setDate(now.getDate() - 7);
                    break;
                case 'month':
                    startDate.setMonth(now.getMonth() - 1);
                    break;
                case 'year':
                    startDate.setFullYear(now.getFullYear() - 1);
                    break;
                default:
                    startDate.setMonth(now.getMonth() - 1);
            }
            // Get transactions for the period
            const transactions = await my_pts_model_1.MyPtsTransactionModel.find({
                userId,
                createdAt: { $gte: startDate, $lte: now }
            }).sort({ createdAt: 1 });
            // Get value history
            const valueHistory = await my_pts_value_model_1.MyPtsValueModel.find({
                createdAt: { $gte: startDate, $lte: now }
            }).sort({ createdAt: 1 });
            // Group transactions by type for distribution
            const distribution = await my_pts_model_1.MyPtsTransactionModel.aggregate([
                {
                    $match: {
                        userId,
                        createdAt: { $gte: startDate, $lte: now }
                    }
                },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 },
                        volume: { $sum: { $abs: '$amount' } }
                    }
                }
            ]);
            // Format response data
            const response = {
                transactionHistory: {
                    incoming: transactions
                        .filter((t) => t.amount > 0)
                        .map((t) => ({ timestamp: t.createdAt, value: t.amount })),
                    outgoing: transactions
                        .filter((t) => t.amount < 0)
                        .map((t) => ({ timestamp: t.createdAt, value: Math.abs(t.amount) }))
                },
                balanceTrend: transactions.map((t) => ({
                    timestamp: t.createdAt,
                    value: t.balance
                })),
                valueHistory: valueHistory.map((v) => ({
                    timestamp: v.effectiveDate,
                    value: v.baseValue,
                    totalSupply: v.totalSupply,
                    totalValue: v.totalValueUSD,
                    exchangeRate: v.getValueInCurrency(currency)
                })),
                activityDistribution: distribution.map((d) => ({
                    type: d._id,
                    count: d.count,
                    volume: d.volume
                }))
            };
            res.json({
                success: true,
                data: response
            });
        }
        catch (error) {
            logger_1.logger.error('Error in getDashboardAnalytics:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch analytics data'
            });
        }
    },
    async getTransactionHistory(req, res) {
        try {
            const user = req.user;
            const { startDate, endDate } = req.query;
            const userId = (user === null || user === void 0 ? void 0 : user._id) || (user === null || user === void 0 ? void 0 : user.id);
            if (!startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Start date and end date are required'
                });
            }
            const transactions = await my_pts_model_1.MyPtsTransactionModel.find({
                userId,
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }).sort({ createdAt: 1 });
            const history = transactions.map((t) => ({
                timestamp: t.createdAt,
                value: t.amount
            }));
            res.json({
                success: true,
                data: history
            });
        }
        catch (error) {
            logger_1.logger.error('Error in getTransactionHistory:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch transaction history'
            });
        }
    },
    async getBalanceTrend(req, res) {
        try {
            const user = req.user;
            const { startDate, endDate } = req.query;
            const userId = (user === null || user === void 0 ? void 0 : user._id) || (user === null || user === void 0 ? void 0 : user.id);
            if (!startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Start date and end date are required'
                });
            }
            const transactions = await my_pts_model_1.MyPtsTransactionModel.find({
                userId,
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }).sort({ createdAt: 1 });
            const trend = transactions.map((t) => ({
                timestamp: t.createdAt,
                value: t.balance
            }));
            res.json({
                success: true,
                data: trend
            });
        }
        catch (error) {
            logger_1.logger.error('Error in getBalanceTrend:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch balance trend'
            });
        }
    }
};
