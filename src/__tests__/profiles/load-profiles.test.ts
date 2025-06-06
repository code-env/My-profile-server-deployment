import { ProfileModel } from '../../models/profile.model';
import { ProfileTemplate } from '../../models/profiles/profile-template';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('Load Profiles Test', () => {
  let mongoServer: MongoMemoryServer;
  let testTemplate: any;

  beforeAll(async () => {
    // Start in-memory MongoDB for testing
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create a test template first
    testTemplate = await ProfileTemplate.create({
      profileCategory: 'individual',
      profileType: 'personal',
      name: 'Test Personal Template',
      slug: 'test-personal',
      categories: [
        {
          name: 'basic',
          label: 'Basic Information',
          fields: [
            {
              name: 'firstName',
              label: 'First Name',
              widget: 'text',
              order: 1,
              enabled: true,
              required: true
            }
          ]
        }
      ],
      createdBy: new mongoose.Types.ObjectId()
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  async function loadTestProfiles() {
    const profiles = await ProfileModel.find({})
      .limit(4)
      .select('_id profileInformation')
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

  it('should throw error when not enough profiles exist', async () => {
    // Since we're using an empty in-memory database initially, 
    // this test will check the error handling
    await expect(loadTestProfiles()).rejects.toThrow('Not enough profiles in database');
  });

  it('should handle profile data correctly when profiles exist', async () => {
    // Create some test profiles for this test    
    for (let i = 1; i <= 4; i++) {
      await ProfileModel.create({
        profileCategory: 'individual',
        profileType: 'personal',
        templatedId: testTemplate._id,
        sections: [],
        ProfileFormat: {
          updatedAt: new Date()
        },
        profileInformation: {
          creator: new mongoose.Types.ObjectId(),
          firstName: `Test${i}`,
          lastName: `User${i}`,
          username: `testuser${i}-${Date.now()}-${i}`, // Make unique
          profileLink: `https://myprofile.com/testuser${i}-${Date.now()}-${i}`,
          connectLink: `https://myprofile.com/connect/testuser${i}-${Date.now()}-${i}`,
          followLink: `https://myprofile.com/follow/testuser${i}-${Date.now()}-${i}`,
          followers: [],
          following: [],
          connectedProfiles: [],
          affiliatedProfiles: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        owner: new mongoose.Types.ObjectId()
      });
    }

    // Now test loading profiles
    const profiles = await loadTestProfiles();
    
    expect(profiles).toHaveProperty('profile1');
    expect(profiles).toHaveProperty('profile2');
    expect(profiles).toHaveProperty('profile3');
    expect(profiles).toHaveProperty('profile4');

    // Check that each profile has the expected structure
    Object.entries(profiles).forEach(([key, profile]) => {
      expect(profile).toHaveProperty('_id');
      expect(profile).toHaveProperty('profileInformation');
      if (profile.profileInformation) {
        expect(profile.profileInformation).toHaveProperty('username');
        console.log(`${key} username:`, profile.profileInformation.username);
      }
    });
  });

  it('should load profiles with correct data structure', async () => {
    // Clear existing profiles first
    await ProfileModel.deleteMany({});

    // Create test profiles with proper data
    for (let i = 1; i <= 4; i++) {
      await ProfileModel.create({
        profileCategory: 'individual',
        profileType: 'personal',
        templatedId: testTemplate._id,
        sections: [],
        ProfileFormat: {
          updatedAt: new Date()
        },
        profileInformation: {
          creator: new mongoose.Types.ObjectId(),
          firstName: `LoadTest${i}`,
          lastName: `User${i}`,
          username: `loadtestuser${i}-${Date.now()}`,
          profileLink: `https://myprofile.com/loadtestuser${i}-${Date.now()}`,
          connectLink: `https://myprofile.com/connect/loadtestuser${i}-${Date.now()}`,
          followLink: `https://myprofile.com/follow/loadtestuser${i}-${Date.now()}`,
          followers: [],
          following: [],
          connectedProfiles: [],
          affiliatedProfiles: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        owner: new mongoose.Types.ObjectId()
      });
    }

    const profiles = await loadTestProfiles();
    
    // Verify all profiles are loaded correctly
    expect(Object.keys(profiles)).toHaveLength(4);
    
    // Test accessing username safely
    Object.entries(profiles).forEach(([key, profile]) => {
      const username = profile.profileInformation?.username;
      expect(username).toBeDefined();
      expect(typeof username).toBe('string');
      expect(username).toContain('loadtestuser');
    });
  });
}); 