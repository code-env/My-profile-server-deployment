/**
 * Script to update all profiles with country information from their corresponding users
 *
 * Run with: npx ts-node src/scripts/update-profile-countries.ts
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';
import { ProfileModel } from '../models/profile.model';
import { User } from '../models/User';
import { logger } from '../utils/logger';

// Load environment variables
config();

// Comprehensive mapping of all countries with their ISO codes
const countryCodeMap: Record<string, string> = {
  'Afghanistan': 'AF',
  'Albania': 'AL',
  'Algeria': 'DZ',
  'Andorra': 'AD',
  'Angola': 'AO',
  'Antigua and Barbuda': 'AG',
  'Argentina': 'AR',
  'Armenia': 'AM',
  'Australia': 'AU',
  'Austria': 'AT',
  'Azerbaijan': 'AZ',
  'Bahamas': 'BS',
  'Bahrain': 'BH',
  'Bangladesh': 'BD',
  'Barbados': 'BB',
  'Belarus': 'BY',
  'Belgium': 'BE',
  'Belize': 'BZ',
  'Benin': 'BJ',
  'Bhutan': 'BT',
  'Bolivia': 'BO',
  'Bosnia and Herzegovina': 'BA',
  'Botswana': 'BW',
  'Brazil': 'BR',
  'Brunei': 'BN',
  'Bulgaria': 'BG',
  'Burkina Faso': 'BF',
  'Burundi': 'BI',
  'Cambodia': 'KH',
  'Cameroon': 'CM',
  'Canada': 'CA',
  'Cape Verde': 'CV',
  'Central African Republic': 'CF',
  'Chad': 'TD',
  'Chile': 'CL',
  'China': 'CN',
  'Colombia': 'CO',
  'Comoros': 'KM',
  'Congo': 'CG',
  'Costa Rica': 'CR',
  'Croatia': 'HR',
  'Cuba': 'CU',
  'Cyprus': 'CY',
  'Czech Republic': 'CZ',
  'Democratic Republic of the Congo': 'CD',
  'Denmark': 'DK',
  'Djibouti': 'DJ',
  'Dominica': 'DM',
  'Dominican Republic': 'DO',
  'East Timor': 'TL',
  'Ecuador': 'EC',
  'Egypt': 'EG',
  'El Salvador': 'SV',
  'Equatorial Guinea': 'GQ',
  'Eritrea': 'ER',
  'Estonia': 'EE',
  'Eswatini': 'SZ',
  'Ethiopia': 'ET',
  'Fiji': 'FJ',
  'Finland': 'FI',
  'France': 'FR',
  'Gabon': 'GA',
  'Gambia': 'GM',
  'Georgia': 'GE',
  'Germany': 'DE',
  'Ghana': 'GH',
  'Greece': 'GR',
  'Grenada': 'GD',
  'Guatemala': 'GT',
  'Guinea': 'GN',
  'Guinea-Bissau': 'GW',
  'Guyana': 'GY',
  'Haiti': 'HT',
  'Honduras': 'HN',
  'Hungary': 'HU',
  'Iceland': 'IS',
  'India': 'IN',
  'Indonesia': 'ID',
  'Iran': 'IR',
  'Iraq': 'IQ',
  'Ireland': 'IE',
  'Israel': 'IL',
  'Italy': 'IT',
  'Ivory Coast': 'CI',
  'Jamaica': 'JM',
  'Japan': 'JP',
  'Jordan': 'JO',
  'Kazakhstan': 'KZ',
  'Kenya': 'KE',
  'Kiribati': 'KI',
  'Kuwait': 'KW',
  'Kyrgyzstan': 'KG',
  'Laos': 'LA',
  'Latvia': 'LV',
  'Lebanon': 'LB',
  'Lesotho': 'LS',
  'Liberia': 'LR',
  'Libya': 'LY',
  'Liechtenstein': 'LI',
  'Lithuania': 'LT',
  'Luxembourg': 'LU',
  'Madagascar': 'MG',
  'Malawi': 'MW',
  'Malaysia': 'MY',
  'Maldives': 'MV',
  'Mali': 'ML',
  'Malta': 'MT',
  'Marshall Islands': 'MH',
  'Mauritania': 'MR',
  'Mauritius': 'MU',
  'Mexico': 'MX',
  'Micronesia': 'FM',
  'Moldova': 'MD',
  'Monaco': 'MC',
  'Mongolia': 'MN',
  'Montenegro': 'ME',
  'Morocco': 'MA',
  'Mozambique': 'MZ',
  'Myanmar': 'MM',
  'Namibia': 'NA',
  'Nauru': 'NR',
  'Nepal': 'NP',
  'Netherlands': 'NL',
  'New Zealand': 'NZ',
  'Nicaragua': 'NI',
  'Niger': 'NE',
  'Nigeria': 'NG',
  'North Korea': 'KP',
  'North Macedonia': 'MK',
  'Norway': 'NO',
  'Oman': 'OM',
  'Pakistan': 'PK',
  'Palau': 'PW',
  'Palestine': 'PS',
  'Panama': 'PA',
  'Papua New Guinea': 'PG',
  'Paraguay': 'PY',
  'Peru': 'PE',
  'Philippines': 'PH',
  'Poland': 'PL',
  'Portugal': 'PT',
  'Qatar': 'QA',
  'Romania': 'RO',
  'Russia': 'RU',
  'Rwanda': 'RW',
  'Saint Kitts and Nevis': 'KN',
  'Saint Lucia': 'LC',
  'Saint Vincent and the Grenadines': 'VC',
  'Samoa': 'WS',
  'San Marino': 'SM',
  'Sao Tome and Principe': 'ST',
  'Saudi Arabia': 'SA',
  'Senegal': 'SN',
  'Serbia': 'RS',
  'Seychelles': 'SC',
  'Sierra Leone': 'SL',
  'Singapore': 'SG',
  'Slovakia': 'SK',
  'Slovenia': 'SI',
  'Solomon Islands': 'SB',
  'Somalia': 'SO',
  'South Africa': 'ZA',
  'South Korea': 'KR',
  'South Sudan': 'SS',
  'Spain': 'ES',
  'Sri Lanka': 'LK',
  'Sudan': 'SD',
  'Suriname': 'SR',
  'Sweden': 'SE',
  'Switzerland': 'CH',
  'Syria': 'SY',
  'Taiwan': 'TW',
  'Tajikistan': 'TJ',
  'Tanzania': 'TZ',
  'Thailand': 'TH',
  'Togo': 'TG',
  'Tonga': 'TO',
  'Trinidad and Tobago': 'TT',
  'Tunisia': 'TN',
  'Turkey': 'TR',
  'Turkmenistan': 'TM',
  'Tuvalu': 'TV',
  'Uganda': 'UG',
  'Ukraine': 'UA',
  'United Arab Emirates': 'AE',
  'United Kingdom': 'GB',
  'United States': 'US',
  'Uruguay': 'UY',
  'Uzbekistan': 'UZ',
  'Vanuatu': 'VU',
  'Vatican City': 'VA',
  'Venezuela': 'VE',
  'Vietnam': 'VN',
  'Yemen': 'YE',
  'Zambia': 'ZM',
  'Zimbabwe': 'ZW'
};

async function updateProfileCountries() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myprofile';
    await mongoose.connect(mongoURI);
    logger.info('Connected to MongoDB');

    // Get all profiles
    const profiles = await ProfileModel.find({});
    logger.info(`Found ${profiles.length} profiles to update`);

    let updatedCount = 0;
    let errorCount = 0;

    // Process each profile using direct MongoDB update
    for (const profile of profiles) {
      try {
        // Get the creator ID
        const creatorId = profile.profileInformation.creator;
        if (!creatorId) {
          logger.warn(`Profile ${profile._id} has no creator ID, skipping`);
          continue;
        }

        // Find the user
        const user = await User.findById(creatorId);
        if (!user) {
          logger.warn(`User not found for profile ${profile._id}, skipping`);
          continue;
        }

        // Get country information
        const userCountry = user.countryOfResidence || '';
        const countryCode = countryCodeMap[userCountry] || '';

        // Update profile with country information using direct MongoDB update
        if (userCountry && userCountry !== 'Unknown') {
          // Use updateOne with $set to update only the specific fields
          const result = await ProfileModel.updateOne(
            { _id: profile._id },
            {
              $set: {
                'profileLocation.country': userCountry,
                'profileLocation.countryCode': countryCode,
                // Set default coordinates if they don't exist
                'profileLocation.coordinates.latitude': 0,
                'profileLocation.coordinates.longitude': 0
              }
            }
          );

          if (result.modifiedCount > 0) {
            updatedCount++;
            logger.info(`Updated profile ${profile._id} with country: ${userCountry}, code: ${countryCode}`);
          } else {
            logger.warn(`No changes made to profile ${profile._id}`);
          }
        } else {
          // For users without country information, set a default placeholder
          // This prevents the profile from being skipped entirely
          const result = await ProfileModel.updateOne(
            { _id: profile._id },
            {
              $set: {
                'profileLocation.country': 'Not Specified',
                'profileLocation.countryCode': '',
                // Set default coordinates
                'profileLocation.coordinates.latitude': 0,
                'profileLocation.coordinates.longitude': 0
              }
            }
          );

          if (result.modifiedCount > 0) {
            updatedCount++;
            logger.info(`Updated profile ${profile._id} with placeholder country (user has no country info)`);
          }

          logger.warn(`User ${user._id} has no country information, skipping profile ${profile._id}`);
        }
      } catch (error) {
        errorCount++;
        logger.error(`Error updating profile ${profile._id}:`, error);
      }
    }

    logger.info(`Update complete. Updated ${updatedCount} profiles. Errors: ${errorCount}`);
  } catch (error) {
    logger.error('Error in update script:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run the update function
updateProfileCountries().catch(error => {
  logger.error('Unhandled error in script:', error);
  process.exit(1);
});
