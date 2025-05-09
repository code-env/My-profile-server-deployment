import { ProfileModel } from './../../models/profile.model';
import mongoose from 'mongoose';


async function loadTestProfiles() {
    const profiles = await ProfileModel.find({})
        .limit(4)
        .select('_id name email avatar')
        .lean();

    if (profiles.length < 4) {
        throw new Error('Not enough profiles in database. Need at least 4 profiles.');
    }

    return {
        profile1: profiles[0],
        profile2: profiles[1],
        profile3: profiles[2],
        profile4: profiles[3]
    };
}

async function main() {
    try {
        const MONGODB_URI = "mongodb+srv://admin:Brilydl123@my-profile-cluster.qnkxq.mongodb.net/?retryWrites=true&w=majority&appName=my-profile-cluster"
        console.log('MONGODB_URI', MONGODB_URI);
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI as string);
        console.log('Connected to MongoDB');

        // Load profiles
        const profiles = await loadTestProfiles();
        console.log('\nLoaded Profiles:');
        Object.entries(profiles).forEach(([key, profile]) => {
            console.log(`\n${key}:`);
            console.log('ID:', profile._id);
            console.log('Name:', profile.profileInformation.username);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

main();
