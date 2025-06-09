import mongoose, { Document, Schema, Model } from 'mongoose';

export interface Country extends Document {
    name: string;
    code: string;
    phoneCode: string;
    continent: string;
    capital?: string;
    languages?: string[];
    currency?: string;
    flagUrl?: string;
}
const countrySchema = new Schema<Country>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            index: true
        },
        code: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            index: true
        },
        phoneCode: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            index: true
        },
        continent: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        capital: {
            type: String,
            trim: true
        },
        languages: [{
            type: String,
            trim: true
        }],
        currency: {
            type: String,
            trim: true
        },
        flagUrl: {
            type: String,
            trim: true,
            default: ''
        }
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: function (doc, ret) {
                delete ret.__v;
                if (!ret.capital) {
                    delete ret.capital;
                }
                if (!ret.languages || ret.languages.length === 0) {
                    delete ret.languages;
                }
                if (!ret.currency) {
                    delete ret.currency;
                }
                if (!ret.flagUrl) {
                    delete ret.flagUrl;
                }
            }   

        }
    }
);
// Create the model
const CountryModel: Model<Country> = mongoose.model<Country>('Country', countrySchema);

export default CountryModel;