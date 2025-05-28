import { Schema, model, Document, Types } from 'mongoose';

export interface IOrganization extends Document {
  name: string;
  description?: string;
  logo?: {
    url: string;
    publicId: string;
  };
  coverImage?: {
    url: string;
    publicId: string;
  };
  type: 'company' | 'non-profit' | 'government' | 'educational' | 'other';
  industry?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  socialMedia?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  foundedDate?: Date;
  size?: '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+';
  status: 'active' | 'inactive' | 'pending';
  members: Array<{
    profileId: Types.ObjectId;
    role: 'owner' | 'admin' | 'member';
    joinedAt: Date;
    status: 'active' | 'inactive' | 'pending';
  }>;
  settings: {
    allowMemberInvites: boolean;
    requireApproval: boolean;
    visibility: 'public' | 'private' | 'members-only';
    defaultRole: 'member';
  };
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>({
  name: { type: String, required: true },
  description: String,
  logo: {
    url: String,
    publicId: String
  },
  coverImage: {
    url: String,
    publicId: String
  },
  type: {
    type: String,
    enum: ['company', 'non-profit', 'government', 'educational', 'other'],
    required: true
  },
  industry: String,
  website: String,
  email: String,
  phone: String,
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  socialMedia: {
    linkedin: String,
    twitter: String,
    facebook: String,
    instagram: String
  },
  foundedDate: Date,
  size: {
    type: String,
    enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'active'
  },
  members: [{
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'Profile',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending'],
      default: 'active'
    }
  }],
  settings: {
    allowMemberInvites: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: false
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'members-only'],
      default: 'public'
    },
    defaultRole: {
      type: String,
      enum: ['member'],
      default: 'member'
    }
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Profile',
    required: true
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Profile',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
OrganizationSchema.index({ name: 1 });
OrganizationSchema.index({ 'members.profileId': 1 });
OrganizationSchema.index({ status: 1 });
OrganizationSchema.index({ type: 1 });

// Methods
OrganizationSchema.methods.addMember = async function(
  profileId: Types.ObjectId,
  role: 'owner' | 'admin' | 'member' = 'member'
): Promise<void> {
  if (this.members.some((m: { profileId: Types.ObjectId }) => m.profileId.equals(profileId))) {
    throw new Error('Profile is already a member');
  }
  
  this.members.push({
    profileId,
    role,
    joinedAt: new Date(),
    status: 'active'
  });
  
  await this.save();
};

OrganizationSchema.methods.removeMember = async function(
  profileId: Types.ObjectId
): Promise<void> {
  this.members = this.members.filter((m: { profileId: Types.ObjectId }) => !m.profileId.equals(profileId));
  await this.save();
};

OrganizationSchema.methods.updateMemberRole = async function(
  profileId: Types.ObjectId,
  newRole: 'owner' | 'admin' | 'member'
): Promise<void> {
  const member = this.members.find((m: { profileId: Types.ObjectId }) => m.profileId.equals(profileId));
  if (!member) {
    throw new Error('Profile is not a member');
  }
  
  member.role = newRole;
  await this.save();
};

OrganizationSchema.methods.isMember = function(profileId: Types.ObjectId): boolean {
  return this.members.some((m: { profileId: Types.ObjectId }) => m.profileId.equals(profileId));
};

OrganizationSchema.methods.isAdmin = function(profileId: Types.ObjectId): boolean {
  return this.members.some((m: { profileId: Types.ObjectId, role: string }) => 
    m.profileId.equals(profileId) && 
    (m.role === 'owner' || m.role === 'admin')
  );
};

OrganizationSchema.methods.isOwner = function(profileId: Types.ObjectId): boolean {
  return this.members.some((m: { profileId: Types.ObjectId, role: string }) => 
    m.profileId.equals(profileId) && 
    m.role === 'owner'
  );
};

export const Organization = model<IOrganization>('Organization', OrganizationSchema); 