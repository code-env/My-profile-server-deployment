"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTokens = void 0;
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const passport_facebook_1 = require("passport-facebook");
const passport_linkedin_oauth2_1 = require("passport-linkedin-oauth2");
const User_1 = require("../models/User");
const logger_1 = require("../utils/logger");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config/config");
// Maximum number of refresh tokens to store per user
const MAX_REFRESH_TOKENS = 3;
// Generate access and refresh tokens
const generateTokens = (userId, email) => {
    const jwtSecret = process.env.JWT_SECRET || '';
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || '';
    // Use string literals instead of config values to avoid type errors
    const accessTokenOptions = {
        expiresIn: "4h" // Extended from 1h to 4h for better user experience
    };
    const refreshTokenOptions = {
        expiresIn: "30d" // Same as config.JWT_REFRESH_EXPIRATION
    };
    const accessToken = jsonwebtoken_1.default.sign({ userId, email }, jwtSecret, accessTokenOptions);
    const refreshToken = jsonwebtoken_1.default.sign({ userId, email, type: 'refresh' }, jwtRefreshSecret, refreshTokenOptions);
    return { accessToken, refreshToken };
};
exports.generateTokens = generateTokens;
// Google OAuth Strategy
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: `${config_1.config.BASE_URL}/api/auth/google/callback`,
    scope: ['profile', 'email'],
}, async (_accessToken, _refreshToken, profile, done) => {
    var _a, _b;
    try {
        logger_1.logger.info('Google authentication attempt:', { profileId: profile.id });
        // First try to find user by googleId
        let user = await User_1.User.findOne({ googleId: profile.id });
        if (!user && profile.emails && profile.emails.length > 0) {
            // If not found by googleId, try to find by email
            user = await User_1.User.findOne({ email: profile.emails[0].value });
            if (user) {
                // Link Google account to existing user
                user.googleId = profile.id;
                user.signupType = 'google';
                user.isEmailVerified = true;
                await user.save();
                logger_1.logger.info('Linked Google account to existing user', { userId: user.id });
            }
            else {
                // Create new user
                const username = profile.emails[0].value.split('@')[0];
                user = new User_1.User({
                    googleId: profile.id,
                    email: profile.emails[0].value,
                    fullName: profile.displayName,
                    username: username,
                    signupType: 'google',
                    isEmailVerified: true,
                    password: 'oauth2-user-no-password', // This will be hashed by the User model
                    // Set these fields to undefined to avoid validation errors
                    // They will be collected in the complete-profile page
                    dateOfBirth: undefined,
                    countryOfResidence: undefined,
                    phoneNumber: undefined, // Will be collected in profile completion,
                    accountType: 'MYSELF',
                    accountCategory: 'PRIMARY_ACCOUNT',
                    verificationMethod: 'EMAIL',
                    profileImage: (_b = (_a = profile.photos) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.value,
                    refreshTokens: [],
                });
                await user.save();
                logger_1.logger.info('Created new user from Google authentication', { userId: user.id });
            }
        }
        if (!user) {
            logger_1.logger.error('Failed to create or find user from Google profile');
            return done(new Error('Could not create or find user'));
        }
        // Generate tokens
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user.id.toString(), user.email);
        // Store refresh token (limit the number of tokens)
        if (user.refreshTokens.length >= MAX_REFRESH_TOKENS) {
            // Remove the oldest token
            user.refreshTokens = user.refreshTokens.slice(-MAX_REFRESH_TOKENS + 1);
        }
        user.refreshTokens.push(newRefreshToken);
        await user.save();
        const result = {
            user: user.toObject(),
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        };
        return done(null, result);
    }
    catch (error) {
        logger_1.logger.error('Google auth error:', error);
        return done(error);
    }
}));
// Facebook OAuth Strategy
passport_1.default.use(new passport_facebook_1.Strategy({
    clientID: process.env.FACEBOOK_APP_ID || '',
    clientSecret: process.env.FACEBOOK_APP_SECRET || '',
    callbackURL: `${config_1.config.BASE_URL}/api/auth/facebook/callback`,
    profileFields: ['id', 'emails', 'name', 'displayName', 'photos'],
}, async (_accessToken, _refreshToken, profile, done) => {
    var _a, _b;
    try {
        logger_1.logger.info('Facebook authentication attempt:', { profileId: profile.id });
        // First try to find user by facebookId
        let user = await User_1.User.findOne({ facebookId: profile.id });
        if (!user && profile.emails && profile.emails.length > 0) {
            // If not found by facebookId, try to find by email
            user = await User_1.User.findOne({ email: profile.emails[0].value });
            if (user) {
                // Link Facebook account to existing user
                user.facebookId = profile.id;
                user.signupType = 'facebook';
                user.isEmailVerified = true;
                await user.save();
                logger_1.logger.info('Linked Facebook account to existing user', { userId: user.id });
            }
            else {
                // Create new user
                const username = profile.emails[0].value.split('@')[0];
                user = new User_1.User({
                    facebookId: profile.id,
                    email: profile.emails[0].value,
                    fullName: profile.displayName,
                    username: username,
                    signupType: 'facebook',
                    isEmailVerified: true,
                    password: 'oauth2-user-no-password', // This will be hashed by the User model
                    dateOfBirth: new Date(),
                    countryOfResidence: 'Unknown',
                    accountType: 'MYSELF',
                    accountCategory: 'PRIMARY_ACCOUNT',
                    verificationMethod: 'EMAIL',
                    profileImage: (_b = (_a = profile.photos) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.value,
                    refreshTokens: [],
                });
                await user.save();
                logger_1.logger.info('Created new user from Facebook authentication', { userId: user.id });
            }
        }
        if (!user) {
            logger_1.logger.error('Failed to create or find user from Facebook profile');
            return done(new Error('Could not create or find user'));
        }
        // Generate tokens
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user.id.toString(), user.email);
        // Store refresh token (limit the number of tokens)
        if (user.refreshTokens.length >= MAX_REFRESH_TOKENS) {
            // Remove the oldest token
            user.refreshTokens = user.refreshTokens.slice(-MAX_REFRESH_TOKENS + 1);
        }
        user.refreshTokens.push(newRefreshToken);
        await user.save();
        const result = {
            user: user.toObject(),
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        };
        return done(null, result);
    }
    catch (error) {
        logger_1.logger.error('Facebook auth error:', error);
        return done(error);
    }
}));
// LinkedIn OAuth Strategy
// Use a separate options object to avoid TypeScript errors
const linkedInOptions = {
    clientID: process.env.LINKEDIN_CLIENT_ID || '',
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
    callbackURL: `${config_1.config.BASE_URL}/api/auth/linkedin/callback`,
    scope: ['r_emailaddress', 'r_liteprofile'],
    state: true
};
passport_1.default.use(
// @ts-ignore - Ignore type checking for this strategy
new passport_linkedin_oauth2_1.Strategy(linkedInOptions, async (_accessToken, _refreshToken, profile, done) => {
    var _a, _b;
    try {
        logger_1.logger.info('LinkedIn authentication attempt:', { profileId: profile.id });
        // First try to find user by linkedinId
        let user = await User_1.User.findOne({ linkedinId: profile.id });
        if (!user && profile.emails && profile.emails.length > 0) {
            // If not found by linkedinId, try to find by email
            user = await User_1.User.findOne({ email: profile.emails[0].value });
            if (user) {
                // Link LinkedIn account to existing user
                user.linkedinId = profile.id;
                user.signupType = 'linkedin';
                user.isEmailVerified = true;
                await user.save();
                logger_1.logger.info('Linked LinkedIn account to existing user', { userId: user.id });
            }
            else {
                // Create new user
                const username = profile.emails[0].value.split('@')[0];
                user = new User_1.User({
                    linkedinId: profile.id,
                    email: profile.emails[0].value,
                    fullName: profile.displayName,
                    username: username,
                    signupType: 'linkedin',
                    isEmailVerified: true,
                    password: 'oauth2-user-no-password', // This will be hashed by the User model
                    dateOfBirth: new Date(),
                    countryOfResidence: 'Unknown',
                    accountType: 'MYSELF',
                    accountCategory: 'PRIMARY_ACCOUNT',
                    verificationMethod: 'EMAIL',
                    profileImage: (_b = (_a = profile.photos) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.value,
                    refreshTokens: [],
                });
                await user.save();
                logger_1.logger.info('Created new user from LinkedIn authentication', { userId: user.id });
            }
        }
        if (!user) {
            logger_1.logger.error('Failed to create or find user from LinkedIn profile');
            return done(new Error('Could not create or find user'));
        }
        // Generate tokens
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user.id.toString(), user.email);
        // Store refresh token (limit the number of tokens)
        if (user.refreshTokens.length >= MAX_REFRESH_TOKENS) {
            // Remove the oldest token
            user.refreshTokens = user.refreshTokens.slice(-MAX_REFRESH_TOKENS + 1);
        }
        user.refreshTokens.push(newRefreshToken);
        await user.save();
        const result = {
            user: user.toObject(),
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        };
        return done(null, result);
    }
    catch (error) {
        logger_1.logger.error('LinkedIn auth error:', error);
        return done(error);
    }
}));
// Serialize user for the session
passport_1.default.serializeUser((user, done) => {
    var _a;
    done(null, user.id || ((_a = user.user) === null || _a === void 0 ? void 0 : _a.id));
});
// Deserialize user from the session
passport_1.default.deserializeUser(async (id, done) => {
    try {
        const user = await User_1.User.findById(id);
        done(null, user);
    }
    catch (error) {
        done(error, null);
    }
});
exports.default = passport_1.default;
