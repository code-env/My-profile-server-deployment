/**
 * Script to update country information for profiles associated with a specific user
 * This script is meant to be called after user information is updated
 *
 * Can be used programmatically by importing the updateUserProfileCountries function
 */

import mongoose from 'mongoose';
import { ProfileModel } from '../models/profile.model';
import { User } from '../models/User';
import { logger } from '../utils/logger';

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

/**
 * Update country information for all profiles associated with a specific user
 * @param userId The MongoDB ID of the user whose profiles need updating
 * @param connectToDb Whether to connect to the database (set to false if connection is already established)
 * @returns Promise<{ success: boolean, updatedCount: number, message: string }>
 */
export async function updateUserProfileCountries(userId: string, connectToDb = true): Promise<{ success: boolean, updatedCount: number, message: string }> {
  let dbConnectionEstablished = false;

  try {
    // Connect to MongoDB if needed
    if (connectToDb) {
      const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myprofile';
      await mongoose.connect(mongoURI);
      dbConnectionEstablished = true;
      logger.info(`Connected to MongoDB to update profiles for user ${userId}`);
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`User not found with ID: ${userId}`);
      return {
        success: false,
        updatedCount: 0,
        message: `User not found with ID: ${userId}`
      };
    }

    // Get country information
    const userCountry = user.countryOfResidence || '';
    const countryCode = countryCodeMap[userCountry] || '';

    if (!userCountry) {
      logger.warn(`User ${userId} has no country information to update`);
      return {
        success: false,
        updatedCount: 0,
        message: 'User has no country information to update'
      };
    }

    // Find all profiles associated with this user
    // Using profileInformation.creator which is the standard way profiles are linked to users
    const profiles = await ProfileModel.find({ 'profileInformation.creator': userId });

    logger.info(`Found ${profiles.length} profiles to update for user ${userId}`);

    if (profiles.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        message: 'No profiles found for this user'
      };
    }

    let updatedCount = 0;

    // Update each profile's country information
    for (const profile of profiles) {
      try {
        // Handle users without country information
        if (!userCountry || userCountry === 'Unknown') {
          const result = await ProfileModel.updateOne(
            { _id: profile._id },
            {
              $set: {
                'profileLocation.country': 'Not Specified',
                'profileLocation.countryCode': '',
                // Set default coordinates if they don't exist
                'profileLocation.coordinates.latitude': profile.profileLocation?.coordinates?.latitude || 0,
                'profileLocation.coordinates.longitude': profile.profileLocation?.coordinates?.longitude || 0
              }
            }
          );

          if (result.modifiedCount > 0) {
            updatedCount++;
            logger.info(`Updated profile ${profile._id} for user ${userId} with placeholder country (user has no country info)`);
          }
        } else {
          const result = await ProfileModel.updateOne(
            { _id: profile._id },
            {
              $set: {
                'profileLocation.country': userCountry,
                'profileLocation.countryCode': countryCode,
                // Set default coordinates if they don't exist
                'profileLocation.coordinates.latitude': profile.profileLocation?.coordinates?.latitude || 0,
                'profileLocation.coordinates.longitude': profile.profileLocation?.coordinates?.longitude || 0
              }
            }
          );

          if (result.modifiedCount > 0) {
            updatedCount++;
            logger.info(`Updated profile ${profile._id} for user ${userId} with country: ${userCountry}, code: ${countryCode}`);
          }
        }
      } catch (error) {
        logger.error(`Error updating profile ${profile._id} for user ${userId}:`, error);
      }
    }

    return {
      success: true,
      updatedCount,
      message: `Successfully updated ${updatedCount} profiles with country information`
    };
  } catch (error) {
    logger.error(`Error updating profiles for user ${userId}:`, error);
    return {
      success: false,
      updatedCount: 0,
      message: `Error updating profiles: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  } finally {
    // Close MongoDB connection if we opened it
    if (connectToDb && dbConnectionEstablished) {
      await mongoose.disconnect();
      logger.info('Disconnected from MongoDB');
    }
  }
}

// If script is run directly, execute with command line arguments
if (require.main === module) {
  // Get userId from command line arguments
  const userId = process.argv[2];

  if (!userId) {
    console.error('Please provide a user ID as a command line argument');
    process.exit(1);
  }

  // Run the update function
  updateUserProfileCountries(userId, true)
    .then(result => {
      console.log(result.message);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}
