import { Request, Response } from 'express';
import { AnalyticsDashboardService } from '../services/analytics-dashboard.service';
import { logger } from '../utils/logger';

// Initialize service
const analyticsDashboardService = new AnalyticsDashboardService();

/**
 * Get the analytics dashboard for a profile
 * @route GET /api/analytics/dashboard/:profileId
 */
export const getDashboard = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const dashboard = await analyticsDashboardService.getDashboard(profileId);

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('Error getting analytics dashboard:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get analytics dashboard'
    });
  }
};

/**
 * Refresh the analytics dashboard with the latest data
 * @route POST /api/analytics/dashboard/:profileId/refresh
 */
export const refreshDashboard = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const dashboard = await analyticsDashboardService.refreshDashboard(profileId);

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('Error refreshing analytics dashboard:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to refresh analytics dashboard'
    });
  }
};

/**
 * Get MyPts analytics for a profile
 * @route GET /api/analytics/dashboard/:profileId/mypts
 */
export const getMyPtsAnalytics = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const dashboard = await analyticsDashboardService.getDashboard(profileId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Analytics dashboard not found for this profile'
      });
    }

    res.json({
      success: true,
      data: dashboard.myPts
    });
  } catch (error) {
    logger.error('Error getting MyPts analytics:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get MyPts analytics'
    });
  }
};

/**
 * Get usage analytics for a profile
 * @route GET /api/analytics/dashboard/:profileId/usage
 */
export const getUsageAnalytics = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const dashboard = await analyticsDashboardService.getDashboard(profileId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Analytics dashboard not found for this profile'
      });
    }

    res.json({
      success: true,
      data: dashboard.usage
    });
  } catch (error) {
    logger.error('Error getting usage analytics:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get usage analytics'
    });
  }
};

/**
 * Get profiling analytics for a profile
 * @route GET /api/analytics/dashboard/:profileId/profiling
 */
export const getProfilingAnalytics = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const dashboard = await analyticsDashboardService.getDashboard(profileId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Analytics dashboard not found for this profile'
      });
    }

    res.json({
      success: true,
      data: dashboard.profiling
    });
  } catch (error) {
    logger.error('Error getting profiling analytics:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get profiling analytics'
    });
  }
};

/**
 * Get products analytics for a profile
 * @route GET /api/analytics/dashboard/:profileId/products
 */
export const getProductsAnalytics = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const dashboard = await analyticsDashboardService.getDashboard(profileId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Analytics dashboard not found for this profile'
      });
    }

    res.json({
      success: true,
      data: dashboard.products
    });
  } catch (error) {
    logger.error('Error getting products analytics:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get products analytics'
    });
  }
};

/**
 * Get networking analytics for a profile
 * @route GET /api/analytics/dashboard/:profileId/networking
 */
export const getNetworkingAnalytics = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const dashboard = await analyticsDashboardService.getDashboard(profileId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Analytics dashboard not found for this profile'
      });
    }

    res.json({
      success: true,
      data: dashboard.networking
    });
  } catch (error) {
    logger.error('Error getting networking analytics:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get networking analytics'
    });
  }
};

/**
 * Get circle analytics for a profile
 * @route GET /api/analytics/dashboard/:profileId/circle
 */
export const getCircleAnalytics = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const dashboard = await analyticsDashboardService.getDashboard(profileId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Analytics dashboard not found for this profile'
      });
    }

    res.json({
      success: true,
      data: dashboard.circle
    });
  } catch (error) {
    logger.error('Error getting circle analytics:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get circle analytics'
    });
  }
};

/**
 * Get engagement analytics for a profile
 * @route GET /api/analytics/dashboard/:profileId/engagement
 */
export const getEngagementAnalytics = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const dashboard = await analyticsDashboardService.getDashboard(profileId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Analytics dashboard not found for this profile'
      });
    }

    res.json({
      success: true,
      data: dashboard.engagement
    });
  } catch (error) {
    logger.error('Error getting engagement analytics:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get engagement analytics'
    });
  }
};

/**
 * Get plans analytics for a profile
 * @route GET /api/analytics/dashboard/:profileId/plans
 */
export const getPlansAnalytics = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const dashboard = await analyticsDashboardService.getDashboard(profileId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Analytics dashboard not found for this profile'
      });
    }

    res.json({
      success: true,
      data: dashboard.plans
    });
  } catch (error) {
    logger.error('Error getting plans analytics:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get plans analytics'
    });
  }
};

/**
 * Get data analytics for a profile
 * @route GET /api/analytics/dashboard/:profileId/data
 */
export const getDataAnalytics = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const dashboard = await analyticsDashboardService.getDashboard(profileId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Analytics dashboard not found for this profile'
      });
    }

    res.json({
      success: true,
      data: dashboard.data
    });
  } catch (error) {
    logger.error('Error getting data analytics:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get data analytics'
    });
  }
};

/**
 * Get vault analytics for a profile
 * @route GET /api/analytics/dashboard/:profileId/vault
 */
export const getVaultAnalytics = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const dashboard = await analyticsDashboardService.getDashboard(profileId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Analytics dashboard not found for this profile'
      });
    }

    res.json({
      success: true,
      data: dashboard.vault
    });
  } catch (error) {
    logger.error('Error getting vault analytics:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get vault analytics'
    });
  }
};

/**
 * Get discover analytics for a profile
 * @route GET /api/analytics/dashboard/:profileId/discover
 */
export const getDiscoverAnalytics = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const dashboard = await analyticsDashboardService.getDashboard(profileId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Analytics dashboard not found for this profile'
      });
    }

    res.json({
      success: true,
      data: dashboard.discover
    });
  } catch (error) {
    logger.error('Error getting discover analytics:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get discover analytics'
    });
  }
};
