"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistrationService = void 0;
const User_1 = require("../models/User");
const errors_1 = require("../utils/errors");
const crypto_1 = require("../utils/crypto");
const email_service_1 = __importDefault(require("./email.service"));
const logger_1 = require("../utils/logger");
class RegistrationService {
    static async initiateRegistration(email) {
        try {
            const existingUser = await User_1.User.findOne({ email });
            if (existingUser) {
                throw new errors_1.CustomError('EMAIL_EXISTS', 'Email already registered');
            }
            const user = await User_1.User.create({
                email,
                registrationStep: 'INITIAL'
            });
            return {
                userId: user._id.toString(),
                step: 'BASIC_INFO',
                message: 'Email validated. Please provide basic information.'
            };
        }
        catch (error) {
            logger_1.logger.error('Error in initiateRegistration:', error);
            throw error;
        }
    }
    static async updateBasicInfo(userId, accountType, fullName, username) {
        try {
            const existingUsername = await User_1.User.findOne({ username });
            if (existingUsername) {
                throw new errors_1.CustomError('USERNAME_EXISTS', 'Username already taken');
            }
            const user = await User_1.User.findByIdAndUpdate(userId, {
                accountType,
                fullName,
                username,
                registrationStep: 'BASIC_INFO'
            }, { new: true });
            if (!user) {
                throw new errors_1.CustomError('USER_NOT_FOUND', 'User not found');
            }
            return {
                userId: user._id.toString(),
                step: 'ELIGIBILITY',
                message: 'Basic information saved. Please verify your eligibility.'
            };
        }
        catch (error) {
            logger_1.logger.error('Error in updateBasicInfo:', error);
            throw error;
        }
    }
    static async updateEligibility(userId, dateOfBirth, countryOfResidence, accountCategory) {
        try {
            const user = await User_1.User.findByIdAndUpdate(userId, {
                dateOfBirth: new Date(dateOfBirth),
                countryOfResidence,
                accountCategory,
                registrationStep: 'ELIGIBILITY'
            }, { new: true });
            if (!user) {
                throw new errors_1.CustomError('USER_NOT_FOUND', 'User not found');
            }
            return {
                userId: user._id.toString(),
                step: 'CONTACT',
                message: 'Eligibility verified. Please provide contact information.'
            };
        }
        catch (error) {
            logger_1.logger.error('Error in updateEligibility:', error);
            throw error;
        }
    }
    static async updateContact(userId, phoneNumber, verificationMethod) {
        try {
            const user = await User_1.User.findByIdAndUpdate(userId, {
                phoneNumber,
                verificationMethod,
                registrationStep: 'CONTACT'
            }, { new: true });
            if (!user) {
                throw new errors_1.CustomError('USER_NOT_FOUND', 'User not found');
            }
            return {
                userId: user._id.toString(),
                step: 'SECURITY',
                message: 'Contact information saved. Please set up your security.'
            };
        }
        catch (error) {
            logger_1.logger.error('Error in updateContact:', error);
            throw error;
        }
    }
    static async setupSecurity(userId, password) {
        try {
            const user = await User_1.User.findById(userId);
            if (!user) {
                throw new errors_1.CustomError('USER_NOT_FOUND', 'User not found');
            }
            const otp = (0, crypto_1.generateOTP)(6);
            const otpExpiry = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);
            const verificationData = {
                otp,
                otpExpiry,
                attempts: 0
            };
            await User_1.User.findByIdAndUpdate(userId, {
                password,
                verificationData,
                registrationStep: 'VERIFICATION'
            }, { new: true });
            if (user.verificationMethod === 'EMAIL') {
                await email_service_1.default.sendVerificationEmail(user.email, otp);
            }
            else {
                throw new errors_1.CustomError('SMS_NOT_IMPLEMENTED', 'SMS service not implemented');
            }
            const id = user._id.toString();
            return {
                userId: user._id.toString(),
                step: 'VERIFICATION',
                verificationMethod: user.verificationMethod,
                message: `Security setup complete. Please verify your ${user.verificationMethod.toLowerCase()}.`
            };
        }
        catch (error) {
            logger_1.logger.error('Error in setupSecurity:', error);
            throw error;
        }
    }
    static async verifyOTP(userId, otp) {
        try {
            const user = await User_1.User.findById(userId);
            if (!user) {
                throw new errors_1.CustomError('USER_NOT_FOUND', 'User not found');
            }
            if (!user.verificationData.otp || !user.verificationData.otpExpiry) {
                throw new errors_1.CustomError('NO_OTP_FOUND', 'No OTP request found');
            }
            if (user.verificationData.otpExpiry < new Date()) {
                throw new errors_1.CustomError('OTP_EXPIRED', 'OTP has expired');
            }
            if (user.verificationData.attempts >= this.MAX_OTP_ATTEMPTS) {
                throw new errors_1.CustomError('MAX_ATTEMPTS_EXCEEDED', 'Maximum verification attempts exceeded');
            }
            if (user.verificationData.otp !== otp) {
                await User_1.User.findByIdAndUpdate(userId, {
                    $inc: { 'verificationData.attempts': 1 }
                });
                throw new errors_1.CustomError('INVALID_OTP', 'Invalid OTP');
            }
            // Mark verification as complete based on method
            const updateData = {
                'verificationData.otp': null,
                'verificationData.otpExpiry': null,
                'verificationData.attempts': 0
            };
            if (user.verificationMethod === 'EMAIL') {
                updateData.isEmailVerified = true;
            }
            else {
                updateData.isPhoneVerified = true;
            }
            await User_1.User.findByIdAndUpdate(userId, updateData);
            return {
                success: true,
                message: 'Verification successful'
            };
        }
        catch (error) {
            logger_1.logger.error('Error in verifyOTP:', error);
            throw error;
        }
    }
}
exports.RegistrationService = RegistrationService;
RegistrationService.OTP_EXPIRY_MINUTES = 10;
RegistrationService.MAX_OTP_ATTEMPTS = 3;
