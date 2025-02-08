import { Request, Response } from 'express';
import { SearchService } from '../services/search.service';
import { logger } from '../utils/logger';

export class SearchController {
  static async searchProfiles(req: Request, res: Response) {
    try {
      const user : any  = req.user;
      const { query, page, limit, filters } = req.query;
      const userId = user?._id;

      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      const results = await SearchService.searchProfiles(
        query as string,
        userId?.toString(),
        {
          page: parseInt(page as string) || 1,
          limit: parseInt(limit as string) || 10,
          filters: filters ? JSON.parse(filters as string) : undefined
        }
      );

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Error in searchProfiles controller:', error);
      res.status(500).json({
        success: false,
        message: 'Error searching profiles'
      });
    }
  }
}
