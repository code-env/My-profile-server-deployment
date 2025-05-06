import { Request, Response } from 'express';
import { MyPtsValueModel } from '../models/my-pts-value.model';
import { logger } from '../utils/logger';
import { MyPtsModel } from '../models/my-pts.model';

/**
 * Get current MyPts value in all supported currencies
 */
export const getCurrentValue = async (req: Request, res: Response) => {
  try {
    const currentValue = await MyPtsValueModel.getCurrentValue();

    return res.status(200).json({
      success: true,
      data: {
        baseValue: currentValue.baseValue,
        baseCurrency: currentValue.baseCurrency,
        baseSymbol: currentValue.baseSymbol,
        effectiveDate: currentValue.effectiveDate,
        exchangeRates: currentValue.exchangeRates,
        totalSupply: currentValue.totalSupply,
        totalValueUSD: currentValue.totalValueUSD,
        previousValue: currentValue.previousValue,
        changePercentage: currentValue.changePercentage
      }
    });
  } catch (error: any) {
    logger.error(`Error getting current MyPts value: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get current MyPts value' });
  }
};

/**
 * Get historical MyPts values
 */
export const getHistoricalValues = async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;

    const historicalValues = await MyPtsValueModel.getHistoricalValues(limit);

    return res.status(200).json({
      success: true,
      data: {
        values: historicalValues.map(value => ({
          baseValue: value.baseValue,
          baseCurrency: value.baseCurrency,
          baseSymbol: value.baseSymbol,
          effectiveDate: value.effectiveDate,
          exchangeRates: value.exchangeRates,
          totalSupply: value.totalSupply,
          totalValueUSD: value.totalValueUSD,
          previousValue: value.previousValue,
          changePercentage: value.changePercentage
        }))
      }
    });
  } catch (error: any) {
    logger.error(`Error getting historical MyPts values: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get historical MyPts values' });
  }
};

/**
 * Calculate MyPts value for a specific amount
 */
export const calculateValue = async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'USD' } = req.query;

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    const currentValue = await MyPtsValueModel.getCurrentValue();
    const valueInCurrency = currentValue.getValueInCurrency(currency as string);
    const totalValue = Number(amount) * valueInCurrency;

    // Find the exchange rate to get the symbol
    let currencySymbol = currentValue.baseSymbol;
    if (currency !== currentValue.baseCurrency) {
      const exchangeRate = currentValue.exchangeRates.find(er => er.currency === currency);
      if (exchangeRate) {
        currencySymbol = exchangeRate.symbol;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        myPts: Number(amount),
        valuePerMyPt: valueInCurrency,
        currency: currency,
        symbol: currencySymbol,
        totalValue: totalValue,
        formattedValue: `${currencySymbol}${totalValue.toFixed(2)}`
      }
    });
  } catch (error: any) {
    logger.error(`Error calculating MyPts value: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to calculate MyPts value' });
  }
};

/**
 * Convert currency amount to equivalent MyPts
 */
export const convertToMyPts = async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'USD' } = req.query;

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    const currentValue = await MyPtsValueModel.getCurrentValue();
    const valueInCurrency = currentValue.getValueInCurrency(currency as string);

    // Calculate how many MyPts the amount can buy
    const myPtsAmount = Number(amount) / valueInCurrency;

    // Find the exchange rate to get the symbol
    let currencySymbol = currentValue.baseSymbol;
    if (currency !== currentValue.baseCurrency) {
      const exchangeRate = currentValue.exchangeRates.find(er => er.currency === currency);
      if (exchangeRate) {
        currencySymbol = exchangeRate.symbol;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        currencyAmount: Number(amount),
        currency: currency,
        symbol: currencySymbol,
        valuePerMyPt: valueInCurrency,
        myPtsAmount: myPtsAmount,
        formattedCurrencyValue: `${currencySymbol}${Number(amount).toFixed(2)}`,
        formattedMyPtsValue: `${myPtsAmount.toFixed(2)} MyPts`
      }
    });
  } catch (error: any) {
    logger.error(`Error converting to MyPts: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to convert to MyPts' });
  }
};

/**
 * Get total MyPts in circulation and their value
 */
export const getTotalSupply = async (req: Request, res: Response) => {
  try {
    const currentValue = await MyPtsValueModel.getCurrentValue();
    const { currency = 'USD' } = req.query;

    // Calculate total value in requested currency
    const totalValueInCurrency = currentValue.getTotalValueInCurrency(currency as string);

    // Find the exchange rate to get the symbol
    let currencySymbol = currentValue.baseSymbol;
    if (currency !== currentValue.baseCurrency) {
      const exchangeRate = currentValue.exchangeRates.find(er => er.currency === currency);
      if (exchangeRate) {
        currencySymbol = exchangeRate.symbol;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        totalSupply: currentValue.totalSupply,
        valuePerMyPt: currentValue.getValueInCurrency(currency as string),
        currency: currency,
        symbol: currencySymbol,
        totalValue: totalValueInCurrency,
        formattedValue: `${currencySymbol}${totalValueInCurrency.toFixed(2)}`
      }
    });
  } catch (error: any) {
    logger.error(`Error getting total MyPts supply: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get total MyPts supply' });
  }
};

/**
 * Update MyPts value (admin only)
 */
export const updateMyPtsValue = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const {
      baseValue,
      exchangeRates,
      totalSupply = 1000000000 // Default to the current supply (1 billion) if not provided
    } = req.body;

    if (!baseValue || !exchangeRates || !Array.isArray(exchangeRates)) {
      return res.status(400).json({
        success: false,
        message: 'Base value and exchange rates are required'
      });
    }

    // Get the previous value for change calculation
    let previousValue = null;
    let changePercentage = null;

    try {
      const latestValue = await MyPtsValueModel.getCurrentValue();
      previousValue = latestValue.baseValue;
      changePercentage = ((baseValue - previousValue) / previousValue) * 100;
    } catch (error) {
      // If no previous value exists, that's okay
      logger.info('No previous MyPts value found for change calculation');
    }

    // Calculate total value in USD
    const totalValueUSD = totalSupply * baseValue;

    // Create new value record
    const newValue = await MyPtsValueModel.create({
      baseValue,
      baseCurrency: 'USD',
      baseSymbol: '$',
      exchangeRates,
      effectiveDate: new Date(),
      previousValue,
      changePercentage,
      totalSupply,
      totalValueUSD
    });

    return res.status(201).json({
      success: true,
      data: {
        value: newValue,
        message: 'MyPts value updated successfully'
      }
    });
  } catch (error: any) {
    logger.error(`Error updating MyPts value: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to update MyPts value' });
  }
};

/**
 * Initialize MyPts value with default values
 */
export const initializeMyPtsValue = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Check if values already exist
    const existingValues = await MyPtsValueModel.find().countDocuments();
    if (existingValues > 0) {
      return res.status(400).json({
        success: false,
        message: 'MyPts values are already initialized'
      });
    }

    // Default values based on the provided information
    const totalSupply = 1000000000; // 1 billion total supply
    const baseValue = 0.024; // $0.024 USD per MyPt
    const totalValueUSD = totalSupply * baseValue;

    const exchangeRates = [
      {
        currency: 'EUR',
        rate: 0.0208 / 0.024, // Convert to rate relative to USD
        symbol: '€',
        updatedAt: new Date()
      },
      {
        currency: 'GBP',
        rate: 0.0179 / 0.024,
        symbol: '£',
        updatedAt: new Date()
      },
      {
        currency: 'XAF',
        rate: 13.61 / 0.024,
        symbol: 'FCFA',
        updatedAt: new Date()
      },
      {
        currency: 'NGN',
        rate: 38.26 / 0.024,
        symbol: '₦',
        updatedAt: new Date()
      },
      {
        currency: 'PKR',
        rate: 6.74 / 0.024,
        symbol: '₨',
        updatedAt: new Date()
      }
    ];

    // Create initial value record
    const initialValue = await MyPtsValueModel.create({
      baseValue,
      baseCurrency: 'USD',
      baseSymbol: '$',
      exchangeRates,
      effectiveDate: new Date(),
      totalSupply,
      totalValueUSD
    });

    return res.status(201).json({
      success: true,
      data: {
        value: initialValue,
        message: 'MyPts value initialized successfully'
      }
    });
  } catch (error: any) {
    logger.error(`Error initializing MyPts value: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to initialize MyPts value' });
  }
};

/**
 * Add or update exchange rates (admin only)
 */
export const updateExchangeRates = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    const user = req.user as any
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { exchangeRates } = req.body;

    if (!exchangeRates || !Array.isArray(exchangeRates) || exchangeRates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Exchange rates are required and must be a non-empty array'
      });
    }

    // Get the current value
    const currentValue = await MyPtsValueModel.getCurrentValue();

    // Create a map of existing exchange rates for easy lookup
    const existingRatesMap = new Map();
    currentValue.exchangeRates.forEach(rate => {
      existingRatesMap.set(rate.currency, {
        rate: rate.rate,
        symbol: rate.symbol,
        updatedAt: rate.updatedAt
      });
    });

    // Process new exchange rates
    const updatedRates: Array<{
      currency: string;
      rate: number;
      symbol: string;
      updatedAt: Date;
    }> = [];
    const now = new Date();

    // First, add all existing rates to the updated rates array
    currentValue.exchangeRates.forEach(rate => {
      updatedRates.push({
        currency: rate.currency,
        rate: rate.rate,
        symbol: rate.symbol,
        updatedAt: rate.updatedAt
      });
    });

    // Then, update or add new rates
    for (const newRate of exchangeRates) {
      const index = updatedRates.findIndex(r => r.currency === newRate.currency);

      if (index !== -1) {
        // Update existing rate
        updatedRates[index] = {
          currency: newRate.currency,
          rate: newRate.rate,
          symbol: newRate.symbol,
          updatedAt: now
        };
      } else {
        // Add new rate
        updatedRates.push({
          currency: newRate.currency,
          rate: newRate.rate,
          symbol: newRate.symbol,
          updatedAt: now
        });
      }
    }

    // Create a new value record with updated exchange rates
    const newValue = await MyPtsValueModel.create({
      baseValue: currentValue.baseValue,
      baseCurrency: currentValue.baseCurrency,
      baseSymbol: currentValue.baseSymbol,
      exchangeRates: updatedRates,
      effectiveDate: now,
      previousValue: currentValue.baseValue,
      changePercentage: 0, // No change in base value
      totalSupply: currentValue.totalSupply,
      totalValueUSD: currentValue.totalValueUSD
    });

    return res.status(200).json({
      success: true,
      data: {
        value: newValue,
        message: 'Exchange rates updated successfully'
      }
    });
  } catch (error: any) {
    logger.error(`Error updating exchange rates: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to update exchange rates' });
  }
};

/**
 * Get all supported currencies
 */
export const getSupportedCurrencies = async (req: Request, res: Response) => {
  try {
    const currentValue = await MyPtsValueModel.getCurrentValue();

    const currencies = [
      {
        code: currentValue.baseCurrency,
        symbol: currentValue.baseSymbol,
        isBase: true
      },
      ...currentValue.exchangeRates.map(rate => ({
        code: rate.currency,
        symbol: rate.symbol,
        isBase: false
      }))
    ];

    return res.status(200).json({
      success: true,
      data: {
        currencies,
        baseCurrency: currentValue.baseCurrency
      }
    });
  } catch (error: any) {
    logger.error(`Error getting supported currencies: ${error.message}`, { error });
    return res.status(500).json({ success: false, message: 'Failed to get supported currencies' });
  }
};
