"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const my_pts_model_1 = require("./my-pts.model");
const my_pts_value_model_1 = require("./my-pts-value.model");
// Define the Profile Schema
const ProfileSchema = new mongoose_1.Schema({
    profileCategory: {
        type: String,
        required: true,
        enum: ['accessory', 'group', 'individual'],
        index: true,
    },
    profileType: {
        type: String,
        required: true,
        enum: [
            // individual
            'personal', 'academic', 'work', 'professional', 'proprietor', 'freelancer', 'artist', 'influencer', 'athlete', 'provider', 'merchant', 'vendor',
            // accessory
            'emergency', 'medical', 'pet', 'ecommerce', 'home', 'transportation', 'driver', 'event', 'dependent', 'rider',
            // group
            'group', 'team', 'family', 'neighborhood', 'company', 'business', 'association', 'organization', 'institution', 'community'
        ],
        index: true
    },
    secondaryId: {
        type: String,
        unique: true,
        sparse: true, // Allow null values (for existing profiles until updated)
        index: true,
        validate: {
            validator: function (v) {
                // Must start with a letter and be 8 characters long with only alphanumeric characters
                return /^[a-zA-Z][a-zA-Z0-9]{7}$/.test(v);
            },
            message: props => `${props.value} is not a valid secondary ID. It must start with a letter and be 8 characters long.`
        }
    },
    profileInformation: {
        username: { type: String, required: true, trim: true, index: true },
        profileLink: { type: String, required: true, unique: true, index: true },
        title: { type: String, trim: true },
        accountHolder: { type: String, trim: true },
        pid: { type: String, trim: true },
        relationshipToAccountHolder: { type: String, trim: true },
        creator: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        connectLink: { type: String, required: true, unique: true, index: true },
        followLink: { type: String, required: true, unique: true, index: true },
        followers: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Profile' }],
        following: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Profile' }],
        connectedProfiles: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Profile' }],
        affiliatedProfiles: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Profile' }],
        accessToken: { type: String, trim: true, index: true }, // Added for profile token authentication
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    },
    templatedId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ProfileTemplate', required: true },
    sections: [{ type: mongoose_1.Schema.Types.Mixed }],
    members: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Profile' }],
    groups: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Profile' }],
    ProfileFormat: {
        profileImage: { type: String, trim: true },
        coverImage: { type: String, trim: true },
        profileLogo: { type: String, trim: true },
        customization: {
            theme: {
                primaryColor: { type: String, default: '#000000' },
                secondaryColor: { type: String, default: '#ffffff' },
                accent: { type: String, default: '#ff4081' },
                background: { type: String, default: '#f5f5f5' },
                text: { type: String, default: '#212121' },
                font: { type: String, default: 'Roboto' }
            },
            layout: {
                sections: [{ id: String, type: String, order: Number, visible: { type: Boolean, default: true } }],
                gridStyle: { type: String, enum: ['right-sided', 'centered', 'left-sided'], default: 'centered' },
                animation: { type: String, enum: ['fade', 'slide', 'zoom'], default: 'fade' }
            }
        },
        customCSS: { type: String, trim: true },
        updatedAt: { type: Date, default: Date.now }
    },
    ProfileQrCode: {
        qrCode: String,
        emailSignature: String,
        wallPaper: String,
        VirtualBackground: String
    },
    profileLocation: {
        city: String,
        stateOrProvince: String,
        country: String,
        countryCode: String,
        coordinates: {
            latitude: { type: Number, default: 0 },
            longitude: { type: Number, default: 0 }
        }
    },
    ProfileProducts: {
        type: { type: String, enum: ['Accessory', 'Device', 'None'], default: 'None' },
        name: String,
        description: String
    },
    verificationStatus: {
        isVerified: { type: Boolean, default: false },
        badge: {
            type: String,
            enum: ['blue_tick', 'gold_tick', 'none'],
            default: 'none',
        },
        verifiedAt: Date,
    },
    ProfileMypts: {
        currentBalance: { type: Number, default: 0 },
        lifetimeMypts: { type: Number, default: 0 },
    },
    ProfileReferal: {
        referalLink: String,
        referals: { type: Number, default: 0 },
    },
    ProfileBadges: {
        badges: [{
                id: String,
                name: String,
                category: String,
                description: String,
                icon: String,
                earnedAt: Date,
            }],
    },
    analytics: {
        Mypts: {
            balance: { type: Number, default: 0 },
            usage: { type: Number, default: 0 },
            redeemed: { type: Number, default: 0 },
            invested: { type: Number, default: 0 }
        },
        Usage: {
            stamps: { type: Number, default: 0 },
            reward: { type: Number, default: 0 },
            badges: { type: Number, default: 0 },
            milestones: { type: Number, default: 0 }
        },
        Profiling: {
            completion: { type: Number, default: 0 },
            category: { type: Number, default: 0 },
            links: { type: Number, default: 0 },
            content: { type: Number, default: 0 }
        },
        Products: {
            accessories: { type: Number, default: 0 },
            devices: { type: Number, default: 0 },
            taps: { type: Number, default: 0 },
            scans: { type: Number, default: 0 }
        },
        Networking: {
            shared: { type: Number, default: 0 },
            views: { type: Number, default: 0 },
            contacts: { type: Number, default: 0 },
            relationships: { type: Number, default: 0 }
        },
        Circles: {
            contacts: { type: Number, default: 0 },
            connections: { type: Number, default: 0 },
            following: { type: Number, default: 0 },
            followers: { type: Number, default: 0 },
            affiliations: { type: Number, default: 0 }
        },
        engagement: {
            chats: { type: Number, default: 0 },
            calls: { type: Number, default: 0 },
            posts: { type: Number, default: 0 },
            comments: { type: Number, default: 0 }
        },
        plans: {
            interactions: { type: Number, default: 0 },
            task: { type: Number, default: 0 },
            events: { type: Number, default: 0 },
            schedules: { type: Number, default: 0 },
        },
        data: {
            entries: { type: Number, default: 0 },
            dataPts: { type: Number, default: 0 },
            tracking: { type: Number, default: 0 }
        },
        discover: {
            searches: { type: Number, default: 0 },
            Reviews: { type: Number, default: 0 },
            survey: { type: Number, default: 0 },
            videos: { type: Number, default: 0 },
        }
    },
    availability: {
        isAvailable: { type: Boolean, default: false },
        defaultDuration: { type: Number, default: 60 }, // 60 minutes default
        bufferTime: { type: Number, default: 15 }, // 15 minutes default
        endDate: { type: Date }, // Optional end date
        workingHours: {
            type: Map,
            of: {
                start: { type: String, required: true },
                end: { type: String, required: true },
                isWorking: { type: Boolean, default: true }
            },
            default: {}
        },
        exceptions: [{
                date: { type: Date, required: true },
                isAvailable: { type: Boolean, default: true },
                slots: [{
                        start: { type: String, required: true },
                        end: { type: String, required: true }
                    }]
            }],
        bookingWindow: {
            minNotice: { type: Number, default: 60 }, // 1 hour default
            maxAdvance: { type: Number, default: 30 } // 30 days default
        },
        breakTime: [{
                start: { type: String, required: true },
                end: { type: String, required: true },
                days: [{ type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }]
            }]
    },
    specificSettings: {
        type: Map,
        of: {
            type: mongoose_1.Schema.Types.Mixed,
            default: {}
        }
    }
}, { timestamps: true });
// Add profile methods for MyPts
ProfileSchema.methods.getMyPts = async function () {
    // Find or create MyPts for this profile
    const myPts = await my_pts_model_1.MyPtsModel.findOrCreate(this._id);
    return myPts;
};
ProfileSchema.methods.getMyPtsValue = async function (currency = 'USD') {
    var _a, _b, _c;
    try {
        // Get MyPts balance
        const myPts = await this.getMyPts();
        // Get current MyPts value
        const currentValue = await my_pts_value_model_1.MyPtsValueModel.getCurrentValue();
        // Get value in specified currency
        const valuePerPts = currentValue.getValueInCurrency(currency);
        // Calculate total value
        const totalValue = myPts.balance * valuePerPts;
        // Get currency symbol
        let symbol = currentValue.baseSymbol;
        if (currency !== currentValue.baseCurrency) {
            const exchangeRate = currentValue.exchangeRates.find(er => er.currency === currency);
            if (exchangeRate) {
                symbol = exchangeRate.symbol;
            }
        }
        // Format the value
        const formattedValue = `${symbol}${totalValue.toFixed(2)}`;
        return {
            balance: myPts.balance,
            valuePerPts,
            currency,
            symbol,
            totalValue,
            formattedValue
        };
    }
    catch (error) {
        console.error('Error getting MyPts value:', error);
        // Fallback to default values if there's an error
        return {
            balance: ((_a = this.ProfileMypts) === null || _a === void 0 ? void 0 : _a.currentBalance) || 0,
            valuePerPts: 0.024, // Default base value
            currency: currency,
            symbol: currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency,
            totalValue: (((_b = this.ProfileMypts) === null || _b === void 0 ? void 0 : _b.currentBalance) || 0) * 0.024,
            formattedValue: `${currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency}${((((_c = this.ProfileMypts) === null || _c === void 0 ? void 0 : _c.currentBalance) || 0) * 0.024).toFixed(2)}`
        };
    }
};
// Add post-save middleware to create a referral code
ProfileSchema.post('save', async function (doc) {
    try {
        // Import here to avoid circular dependency
        const { ProfileReferralService } = require('../services/profile-referral.service');
        await ProfileReferralService.initializeReferralCode(doc._id);
        console.log(`Referral code initialized for profile: ${doc._id}`);
    }
    catch (error) {
        console.error(`Error initializing referral code for profile ${doc._id}:`, error);
        // Don't throw the error to avoid disrupting the save operation
    }
});
// Add method to check availability for a specific time slot
ProfileSchema.methods.checkAvailability = async function (startTime, endTime) {
    var _a, _b, _c;
    if (!((_a = this.availability) === null || _a === void 0 ? void 0 : _a.isAvailable))
        return false;
    const dayOfWeek = startTime.getDay();
    const workingHours = this.availability.workingHours[dayOfWeek];
    // Check if it's a working day
    if (!(workingHours === null || workingHours === void 0 ? void 0 : workingHours.isWorking))
        return false;
    // Check if time is within working hours
    const startHour = parseInt(workingHours.start.split(':')[0]);
    const startMinute = parseInt(workingHours.start.split(':')[1]);
    const endHour = parseInt(workingHours.end.split(':')[0]);
    const endMinute = parseInt(workingHours.end.split(':')[1]);
    const slotStartHour = startTime.getHours();
    const slotStartMinute = startTime.getMinutes();
    const slotEndHour = endTime.getHours();
    const slotEndMinute = endTime.getMinutes();
    if (slotStartHour < startHour || (slotStartHour === startHour && slotStartMinute < startMinute))
        return false;
    if (slotEndHour > endHour || (slotEndHour === endHour && slotEndMinute > endMinute))
        return false;
    // Check for exceptions
    const dateStr = startTime.toISOString().split('T')[0];
    const exception = (_b = this.availability.exceptions) === null || _b === void 0 ? void 0 : _b.find((e) => e.date.toISOString().split('T')[0] === dateStr);
    if (exception) {
        if (!exception.isAvailable)
            return false;
        if (exception.slots) {
            return exception.slots.some((slot) => {
                const slotStart = new Date(`${dateStr}T${slot.start}`);
                const slotEnd = new Date(`${dateStr}T${slot.end}`);
                return startTime >= slotStart && endTime <= slotEnd;
            });
        }
    }
    // Check for break times
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];
    const isInBreakTime = (_c = this.availability.breakTime) === null || _c === void 0 ? void 0 : _c.some((breakTime) => {
        if (!breakTime.days.includes(dayName))
            return false;
        const breakStart = new Date(`${dateStr}T${breakTime.start}`);
        const breakEnd = new Date(`${dateStr}T${breakTime.end}`);
        return (startTime >= breakStart && startTime < breakEnd) ||
            (endTime > breakStart && endTime <= breakEnd);
    });
    if (isInBreakTime)
        return false;
    return true;
};
// Add method to get available slots for a specific date
ProfileSchema.methods.getAvailableSlots = async function (date) {
    var _a, _b, _c;
    if (!((_a = this.availability) === null || _a === void 0 ? void 0 : _a.isAvailable))
        return [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[date.getDay()];
    const workingHours = this.availability.workingHours[dayOfWeek];
    if (!(workingHours === null || workingHours === void 0 ? void 0 : workingHours.isWorking))
        return [];
    const dateStr = date.toISOString().split('T')[0];
    const slots = [];
    // Check for exceptions
    const exception = (_b = this.availability.exceptions) === null || _b === void 0 ? void 0 : _b.find((e) => e.date.toISOString().split('T')[0] === dateStr);
    if (exception) {
        if (!exception.isAvailable)
            return [];
        if (exception.slots) {
            return exception.slots.map((slot) => ({
                start: new Date(`${dateStr}T${slot.start}`),
                end: new Date(`${dateStr}T${slot.end}`)
            }));
        }
    }
    // Generate slots based on working hours and default duration
    const startTime = new Date(`${dateStr}T${workingHours.start}`);
    const endTime = new Date(`${dateStr}T${workingHours.end}`);
    const duration = this.availability.defaultDuration;
    const buffer = this.availability.bufferTime;
    let currentTime = new Date(startTime);
    while (currentTime < endTime) {
        const slotEnd = new Date(currentTime.getTime() + duration * 60000);
        if (slotEnd <= endTime) {
            // Check if slot overlaps with break time
            const isInBreakTime = (_c = this.availability.breakTime) === null || _c === void 0 ? void 0 : _c.some((breakTime) => {
                if (!breakTime.days.includes(dayOfWeek))
                    return false;
                const breakStart = new Date(`${dateStr}T${breakTime.start}`);
                const breakEnd = new Date(`${dateStr}T${breakTime.end}`);
                return (currentTime >= breakStart && currentTime < breakEnd) ||
                    (slotEnd > breakStart && slotEnd <= breakEnd);
            });
            if (!isInBreakTime) {
                slots.push({
                    start: new Date(currentTime),
                    end: new Date(slotEnd)
                });
            }
        }
        currentTime = new Date(currentTime.getTime() + (duration + buffer) * 60000);
    }
    return slots;
};
// Add the addSettings method
ProfileSchema.methods.addSettings = async function (settings) {
    this.settings = { ...this.settings || {}, ...settings };
    await this.save();
};
exports.ProfileModel = mongoose_1.default.model('Profile', ProfileSchema);
