import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { InteractionService } from '../services/interaction.service';
import { Interaction, InteractionMode, InteractionCategory } from '../models/Interaction';
import { ProfileModel } from '../models/profile.model';
import { IProfile } from '../interfaces/profile.interface';

async function setupTestData() {
    try {
        // Connect to your database
        await mongoose.connect('mongodb://localhost:27017/your-database');
        
        // Create test profiles
        const profile1 = (await ProfileModel.create({
            name: 'Test Profile 1',
            description: 'Test bio 1',
            profileType: 'personal',
            profileCategory: 'Individual',
            owner: new Types.ObjectId(),
            managers: [],
            claimed: false,
            connectLink: `connect-${new Types.ObjectId().toString()}`,
            verificationStatus: {
                isVerified: false,
                badge: 'none'
            },
            kycVerification: {
                status: 'pending',
                verificationLevel: 'basic'
            },
            linkedDevices: [],
            galleries: []
        })).toObject();

        const profile2 = (await ProfileModel.create({
            name: 'Test Profile 2',
            description: 'Test bio 2',
            profileType: 'personal',
            profileCategory: 'Individual',
            owner: new Types.ObjectId(),
            managers: [],
            claimed: false,
            connectLink: `connect-${new Types.ObjectId().toString()}`,
            verificationStatus: {
                isVerified: false,
                badge: 'none'
            },
            kycVerification: {
                status: 'pending',
                verificationLevel: 'basic'
            },
            linkedDevices: [],
            galleries: []
        })).toObject();

        // Initialize interaction service
        const interactionService = new InteractionService(Interaction);

        // Create some test interactions
        await interactionService.createManualInteraction(
            profile1.owner,
            {
                profile: profile1._id,
                relationship: profile2._id,
                mode: InteractionMode.IN_PERSON,
                title: 'Coffee Meeting',
                notes: 'Met for coffee and discussed project',
                category: InteractionCategory.BUSINESS,
                isPhysical: true
            }
        );

        await interactionService.createManualInteraction(
            profile2.owner,
            {
                profile: profile2._id,
                relationship: profile1._id,
                mode: InteractionMode.CALL,
                title: 'Phone Call',
                notes: 'Discussed collaboration opportunities',
                category: InteractionCategory.BUSINESS,
                isPhysical: false
            }
        );

        console.log('Test data setup completed');
        console.log('Profile 1 ID:', profile1._id.toString());
        console.log('Profile 2 ID:', profile2._id.toString());

    } catch (error) {
        console.error('Error setting up test data:', error);
    } finally {
        // Close the connection
        await mongoose.disconnect();
    }
}

// Run the setup
setupTestData(); 