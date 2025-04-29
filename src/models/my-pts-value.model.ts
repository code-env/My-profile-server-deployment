import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IExchangeRate {
  currency: string;
  rate: number;
  symbol: string;
  updatedAt: Date;
}

export interface IMyPtsValue {
  baseValue: number;  // Value in USD
  baseCurrency: string; // "USD"
  baseSymbol: string; // "$"
  exchangeRates: IExchangeRate[];
  effectiveDate: Date;
  previousValue?: number; // For tracking changes
  changePercentage?: number; // For tracking changes
  totalSupply: number; // Total MyPts in circulation
  totalValueUSD: number; // Total value of all MyPts in USD
}

export interface IMyPtsValueMethods {
  getValueInCurrency(currency: string): number;
  getTotalValueInCurrency(currency: string): number;
  convertAmount(amount: number, fromCurrency: string, toCurrency: string): number;
}

// Define MyPtsValue Document type
export type MyPtsValueDocument = IMyPtsValue & Document & IMyPtsValueMethods;

const exchangeRateSchema = new Schema<IExchangeRate>({
  currency: { type: String, required: true },
  rate: { type: Number, required: true },
  symbol: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now }
});

const myPtsValueSchema = new Schema<IMyPtsValue>(
  {
    baseValue: { type: Number, required: true },
    baseCurrency: { type: String, required: true, default: 'USD' },
    baseSymbol: { type: String, required: true, default: '$' },
    exchangeRates: [exchangeRateSchema],
    effectiveDate: { type: Date, default: Date.now },
    previousValue: Number,
    changePercentage: Number,
    totalSupply: { type: Number, required: true },
    totalValueUSD: { type: Number, required: true }
  },
  {
    timestamps: true
  }
);

// Add indexes
myPtsValueSchema.index({ effectiveDate: -1 });

// Add methods to get value in different currencies
myPtsValueSchema.methods.getValueInCurrency = function(currency: string): number {
  if (currency === this.baseCurrency) {
    return this.baseValue;
  }

  const exchangeRate = this.exchangeRates.find((er: { currency: string; }) => er.currency === currency);
  if (!exchangeRate) {
    throw new Error(`Exchange rate for ${currency} not found`);
  }

  return this.baseValue * exchangeRate.rate;
};

// Get total value of all MyPts in a specific currency
myPtsValueSchema.methods.getTotalValueInCurrency = function(currency: string): number {
  const valuePerPts = this.getValueInCurrency(currency);
  return this.totalSupply * valuePerPts;
};

// Convert an amount from one currency to another
myPtsValueSchema.methods.convertAmount = function(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  // Convert to base currency first
  let valueInBaseCurrency;

  if (fromCurrency === this.baseCurrency) {
    valueInBaseCurrency = amount;
  } else {
    const fromRate = this.exchangeRates.find((er: { currency: string; }) => er.currency === fromCurrency);
    if (!fromRate) {
      throw new Error(`Exchange rate for ${fromCurrency} not found`);
    }
    valueInBaseCurrency = amount / fromRate.rate;
  }

  // Then convert to target currency
  if (toCurrency === this.baseCurrency) {
    return valueInBaseCurrency;
  } else {
    const toRate = this.exchangeRates.find((er: { currency: string; }) => er.currency === toCurrency);
    if (!toRate) {
      throw new Error(`Exchange rate for ${toCurrency} not found`);
    }
    return valueInBaseCurrency * toRate.rate;
  }
};

// Static methods
myPtsValueSchema.statics.getCurrentValue = async function(): Promise<MyPtsValueDocument> {
  const latestValue = await this.findOne().sort({ effectiveDate: -1 });

  if (!latestValue) {
    throw new Error('No MyPts value data found');
  }

  return latestValue;
};

myPtsValueSchema.statics.getHistoricalValues = async function(
  limit: number = 30
): Promise<MyPtsValueDocument[]> {
  return this.find()
    .sort({ effectiveDate: -1 })
    .limit(limit);
};

// Define interface for model type
export interface IMyPtsValueModel extends Model<IMyPtsValue, {}, IMyPtsValueMethods> {
  getCurrentValue(): Promise<MyPtsValueDocument>;
  getHistoricalValues(limit?: number): Promise<MyPtsValueDocument[]>;
}

// Create and export the model
export const MyPtsValueModel = mongoose.model<IMyPtsValue, IMyPtsValueModel>(
  'MyPtsValue',
  myPtsValueSchema
);
