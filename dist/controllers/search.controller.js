"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchController = void 0;
const search_service_1 = require("../services/search.service");
const logger_1 = require("../utils/logger");
class SearchController {
    static async searchProfiles(req, res) {
        try {
            const user = req.user;
            const { query, page, limit, filters } = req.query;
            const userId = user === null || user === void 0 ? void 0 : user._id;
            if (!query) {
                return res.status(400).json({
                    success: false,
                    message: 'Search query is required'
                });
            }
            const results = await search_service_1.SearchService.searchProfiles(query, userId === null || userId === void 0 ? void 0 : userId.toString(), {
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 10,
                filters: filters ? JSON.parse(filters) : undefined
            });
            res.json({
                success: true,
                data: results
            });
        }
        catch (error) {
            logger_1.logger.error('Error in searchProfiles controller:', error);
            res.status(500).json({
                success: false,
                message: 'Error searching profiles'
            });
        }
    }
}
exports.SearchController = SearchController;
