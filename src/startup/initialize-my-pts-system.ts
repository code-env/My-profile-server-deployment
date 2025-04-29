import { MyPtsValueModel } from '../models/my-pts-value.model';
import { MyPtsHubModel } from '../models/my-pts-hub.model';
import { logger } from '../utils/logger';

export async function initializeMyPtsSystem() {
  try {
    logger.info('Initializing MyPts system...');

    // Check if MyPtsValue exists
    let myPtsValue = await MyPtsValueModel.findOne();
    if (!myPtsValue) {
      logger.info('Creating initial MyPtsValue record...');
      myPtsValue = await MyPtsValueModel.create({
        baseValue: 1.00,
        baseCurrency: 'USD',
        baseSymbol: '$',
        exchangeRates: [
          {
            currency: 'EUR',
            rate: 0.91,
            symbol: '€',
            updatedAt: new Date()
          },
          {
            currency: 'GBP',
            rate: 0.80,
            symbol: '£',
            updatedAt: new Date()
          }
        ],
        effectiveDate: new Date(),
        totalSupply: 0,
        totalValueUSD: 0
      });
    }

    // Check if MyPtsHub exists
    const hub = await MyPtsHubModel.findOne();
    if (!hub) {
      logger.info('Creating initial MyPtsHub record...');
      await MyPtsHubModel.create({
        totalSupply: 0,
        circulatingSupply: 0,
        reserveSupply: 0,
        valuePerMyPt: 1.00,
        maxSupply: null, // Unlimited supply initially
        logs: []
      });
    }

    logger.info('MyPts system initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize MyPts system', { error });
    throw error;
  }
}
