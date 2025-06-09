import CountryModel, { Country } from '../models/Country';

class CountryService {
    /**
     * Get all countries
     */
    async getAllCountries(filters?: {
        continent?: string;
        search?: string;
    }): Promise<Country[]> {
        const query: any = {};

        // Apply filters
        if (filters?.continent) {
            query.continent = filters.continent;
        }

        if (filters?.search) {
            const searchRegex = new RegExp(filters.search, 'i');
            query.$or = [
                { name: searchRegex },
                { code: searchRegex },
                { capital: searchRegex }
            ];
        }

        const countries = await CountryModel.find(query)
            .sort({ name: 1 })
            .lean();

        return countries;
    }

    /**
     * Get country by ID
     */
    async getCountryById(countryId: string): Promise<Country | null> {
        const country = await CountryModel.findById(countryId).lean();
        return country;
    }

    /**
     * Get country by code (ISO code)
     */
    async getCountryByCode(code: string): Promise<Country | null> {
        const country = await CountryModel.findOne({ 
            code: code.toUpperCase() 
        }).lean();
        return country;
    }

    /**
     * Get country by phone code
     */
    async getCountryByPhoneCode(phoneCode: string): Promise<Country | null> {
        const country = await CountryModel.findOne({ 
            phoneCode: phoneCode 
        }).lean();
        return country;
    }

    /**
     * Get countries by continent
     */
    async getCountriesByContinent(continent: string): Promise<Country[]> {
        const countries = await CountryModel.find({ 
            continent: continent 
        })
        .sort({ name: 1 })
        .lean();
        return countries;
    }

    /**
     * Create a new country
     */
    async createCountry(countryData: Partial<Country>): Promise<Country> {
        // Check if country with same code or name already exists
        const existingCountry = await CountryModel.findOne({
            $or: [
                { code: countryData.code?.toUpperCase() },
                { name: countryData.name },
                { phoneCode: countryData.phoneCode }
            ]
        });

        if (existingCountry) {
            throw new Error('Country with this code, name, or phone code already exists');
        }

        const country = new CountryModel({
            ...countryData,
            code: countryData.code?.toUpperCase()
        });

        await country.save();
        return country.toObject();
    }

    /**
     * Update country
     */
    async updateCountry(countryId: string, updateData: Partial<Country>): Promise<Country> {
        // Check if updating to a code/name/phoneCode that already exists
        if (updateData.code || updateData.name || updateData.phoneCode) {
            const existingCountry = await CountryModel.findOne({
                _id: { $ne: countryId },
                $or: [
                    ...(updateData.code ? [{ code: updateData.code.toUpperCase() }] : []),
                    ...(updateData.name ? [{ name: updateData.name }] : []),
                    ...(updateData.phoneCode ? [{ phoneCode: updateData.phoneCode }] : [])
                ]
            });

            if (existingCountry) {
                throw new Error('Country with this code, name, or phone code already exists');
            }
        }

        if (updateData.code) {
            updateData.code = updateData.code.toUpperCase();
        }

        const country = await CountryModel.findByIdAndUpdate(
            countryId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!country) {
            throw new Error('Country not found');
        }

        return country.toObject();
    }

    /**
     * Delete country
     */
    async deleteCountry(countryId: string): Promise<boolean> {
        const result = await CountryModel.findByIdAndDelete(countryId);
        if (!result) {
            throw new Error('Country not found');
        }
        return true;
    }

    /**
     * Get unique continents
     */
    async getContinents(): Promise<string[]> {
        const continents = await CountryModel.distinct('continent');
        return continents.sort();
    }

    /**
     * Get countries with pagination
     */
    async getCountriesWithPagination(
        page: number = 1,
        limit: number = 50,
        filters?: {
            continent?: string;
            search?: string;
        }
    ): Promise<{
        countries: Country[];
        totalCount: number;
        totalPages: number;
        currentPage: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    }> {
        const query: any = {};

        // Apply filters
        if (filters?.continent) {
            query.continent = filters.continent;
        }

        if (filters?.search) {
            const searchRegex = new RegExp(filters.search, 'i');
            query.$or = [
                { name: searchRegex },
                { code: searchRegex },
                { capital: searchRegex }
            ];
        }

        const skip = (page - 1) * limit;
        
        const [countries, totalCount] = await Promise.all([
            CountryModel.find(query)
                .sort({ name: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            CountryModel.countDocuments(query)
        ]);

        const totalPages = Math.ceil(totalCount / limit);

        return {
            countries,
            totalCount,
            totalPages,
            currentPage: page,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        };
    }

    /**
     * Bulk create countries
     */
    async bulkCreateCountries(countriesData: Partial<Country>[]): Promise<Country[]> {
        // Validate and prepare data
        const preparedData = countriesData.map(country => ({
            ...country,
            code: country.code?.toUpperCase()
        }));

        // Check for duplicates within the batch
        const codes = preparedData.map(c => c.code).filter(Boolean);
        const names = preparedData.map(c => c.name).filter(Boolean);
        const phoneCodes = preparedData.map(c => c.phoneCode).filter(Boolean);

        if (new Set(codes).size !== codes.length) {
            throw new Error('Duplicate country codes found in batch');
        }
        if (new Set(names).size !== names.length) {
            throw new Error('Duplicate country names found in batch');
        }
        if (new Set(phoneCodes).size !== phoneCodes.length) {
            throw new Error('Duplicate phone codes found in batch');
        }

        // Check for existing countries
        const existingCountries = await CountryModel.find({
            $or: [
                { code: { $in: codes } },
                { name: { $in: names } },
                { phoneCode: { $in: phoneCodes } }
            ]
        });

        if (existingCountries.length > 0) {
            const existingCodes = existingCountries.map(c => c.code);
            const existingNames = existingCountries.map(c => c.name);
            const existingPhoneCodes = existingCountries.map(c => c.phoneCode);
            throw new Error(`Countries already exist: codes: ${existingCodes.join(', ')}, names: ${existingNames.join(', ')}, phone codes: ${existingPhoneCodes.join(', ')}`);
        }

        const countries = await CountryModel.insertMany(preparedData);
        return countries.map(country => (country as any).toObject());
    }
}

export default new CountryService(); 