import { Request, Response } from 'express';
import mongoose from 'mongoose';
import countryService from '../services/country.service';

// Helper function to validate country data
const validateCountryData = (data: any) => {
    const errors: string[] = [];

    if (!data.name) errors.push('name is required');
    if (!data.code) errors.push('code is required');
    if (!data.phoneCode) errors.push('phoneCode is required');
    if (!data.continent) errors.push('continent is required');

    if (data.code && data.code.length !== 2) {
        errors.push('code must be exactly 2 characters (ISO 3166-1 alpha-2)');
    }

    if (errors.length > 0) {
        throw new Error(errors.join('; '));
    }
};

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id: string): boolean => {
    return mongoose.Types.ObjectId.isValid(id);
};

export const getAllCountries = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const usePagination = req.query.page || req.query.limit;

        const filters: any = {};
        
        // Apply filters from query params
        if (req.query.continent) filters.continent = req.query.continent;
        if (req.query.search) filters.search = req.query.search;

        let result;
        if (usePagination) {
            result = await countryService.getCountriesWithPagination(page, limit, filters);
        } else {
            const countries = await countryService.getAllCountries(filters);
            result = { countries };
        }

        return successResponse(res, result, 'Countries fetched successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const getCountryById = async (req: Request, res: Response) => {
    try {
        if (!req.params.id || !isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid country ID' });
        }

        const country = await countryService.getCountryById(req.params.id);
        if (!country) {
            return res.status(404).json({ error: 'Country not found' });
        }

        return successResponse(res, country, 'Country fetched successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const getCountryByCode = async (req: Request, res: Response) => {
    try {
        const { code } = req.params;
        if (!code || code.length !== 2) {
            return res.status(400).json({ error: 'Invalid country code. Must be 2 characters.' });
        }

        const country = await countryService.getCountryByCode(code);
        if (!country) {
            return res.status(404).json({ error: 'Country not found' });
        }

        return successResponse(res, country, 'Country fetched successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const getCountryByPhoneCode = async (req: Request, res: Response) => {
    try {
        const { phoneCode } = req.params;
        if (!phoneCode) {
            return res.status(400).json({ error: 'Phone code is required' });
        }

        const country = await countryService.getCountryByPhoneCode(phoneCode);
        if (!country) {
            return res.status(404).json({ error: 'Country not found' });
        }

        return successResponse(res, country, 'Country fetched successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const getCountriesByContinent = async (req: Request, res: Response) => {
    try {
        const { continent } = req.params;
        if (!continent) {
            return res.status(400).json({ error: 'Continent is required' });
        }

        const countries = await countryService.getCountriesByContinent(continent);
        return successResponse(res, countries, 'Countries fetched successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const getContinents = async (req: Request, res: Response) => {
    try {
        const continents = await countryService.getContinents();
        return successResponse(res, continents, 'Continents fetched successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const createCountry = async (req: Request, res: Response) => {
    try {
        validateCountryData(req.body);

        const country = await countryService.createCountry(req.body);
        return successResponse(res, country, 'Country created successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const updateCountry = async (req: Request, res: Response) => {
    try {
        if (!req.params.id || !isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid country ID' });
        }

        // Only validate required fields if they are being updated
        const updateData = req.body;
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No update data provided' });
        }

        // Validate specific fields if they're being updated
        if (updateData.code && updateData.code.length !== 2) {
            return res.status(400).json({ error: 'code must be exactly 2 characters (ISO 3166-1 alpha-2)' });
        }

        const country = await countryService.updateCountry(req.params.id, updateData);
        return successResponse(res, country, 'Country updated successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const deleteCountry = async (req: Request, res: Response) => {
    try {
        if (!req.params.id || !isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid country ID' });
        }

        await countryService.deleteCountry(req.params.id);
        return successResponse(res, null, 'Country deleted successfully');
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

export const bulkCreateCountries = async (req: Request, res: Response) => {
    try {
        if (!Array.isArray(req.body) || req.body.length === 0) {
            return res.status(400).json({ error: 'Array of countries is required' });
        }

        // Validate each country in the batch
        req.body.forEach((country, index) => {
            try {
                validateCountryData(country);
            } catch (error) {
                throw new Error(`Country at index ${index}: ${error instanceof Error ? error.message : 'Invalid data'}`);
            }
        });

        const countries = await countryService.bulkCreateCountries(req.body);
        return successResponse(res, countries, `${countries.length} countries created successfully`);
    } catch (error) {
        handleErrorResponse(error, res);
    }
};

// Helper functions
function handleErrorResponse(error: unknown, res: Response) {
    if (error instanceof Error && error.message === 'Authentication required') {
        return res.status(401).json({ error: error.message });
    }

    let statusCode = 500;
    if (error instanceof Error) {
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('already exists') || 
                   error.message.includes('duplicate') ||
                   error.message.includes('required') ||
                   error.message.includes('must be') ||
                   error.message.includes('Invalid')) {
            statusCode = 400;
        }
    }

    res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        ...(process.env.NODE_ENV === 'development' && { stack: error instanceof Error ? error.stack : undefined })
    });
}

function successResponse(res: Response, data: any, message: string) {
    res.status(200).json({
        message: message,
        success: true,
        data
    });
}

