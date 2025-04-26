import { Request, Response } from 'express';
import { ProfileConnectionModel, IProfileConnection } from '../models/profile-connection.model';
import { ProfileModel } from '../models/profile.model';
import { ProfileConnectionResponse } from '../interfaces/profile-connection.interface';
import mongoose, { Document } from 'mongoose';
import { NotificationService } from '../services/notification.service';

// Create a notification service instance for sending connection-related notifications
const notificationService = new NotificationService();

/**
 * Send a connection request from one profile to another
 *
 * This function handles creating a new connection request between profiles
 * and sends a notification to the receiver.
 *
 * @param req - Express request object containing profileId in params and receiverId in body
 * @param res - Express response object
 */
export const sendConnectionRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("🚀 ~ sendConnectionRequest ~ req.user:", req.user);
    console.log("🚀 ~ sendConnectionRequest ~ req.params:", req.params);
    console.log("🚀 ~ sendConnectionRequest ~ req.body:", req.body);
    const { profileId } = req.params; // Requester profile ID (the profile sending the request)
    const { receiverId, message } = req.body; // Receiver profile ID and optional message

    // Validate that both profiles exist in the database
    const requesterProfile = await ProfileModel.findById(profileId);
    const receiverProfile = await ProfileModel.findById(receiverId);

    if (!requesterProfile) {
      res.status(404).json({ success: false, message: 'Requester profile not found' });
      return;
    }

    if (!receiverProfile) {
      res.status(404).json({ success: false, message: 'Receiver profile not found' });
      return;
    }

    // Security check: Verify that the authenticated user owns the requesting profile
    // This prevents users from sending requests using profiles they don't own
    console.log("🚀 ~ sendConnectionRequest ~ requesterProfile.owner:", requesterProfile.owner.toString());
    console.log("🚀 ~ sendConnectionRequest ~ req.user._id:", (req.user as any)?._id);
    if (requesterProfile.owner.toString() !== (req.user as any)?._id.toString()) {
      console.log("🚀 ~ sendConnectionRequest ~ AUTHORIZATION ERROR: User does not own this profile");
      console.log("error...")
      res.status(403).json({ success: false, message: 'You are not authorized to use this profile...' });
      return;
    }

    // Check if any type of connection already exists between these profiles
    // This prevents duplicate connections or requests
    const existingConnection = await ProfileConnectionModel.findOne({
      $or: [
        { requesterId: profileId, receiverId },
        { requesterId: receiverId, receiverId: profileId }
      ]
    });

    if (existingConnection) {
      res.status(400).json({
        success: false,
        message: 'A connection already exists between these profiles',
        connection: existingConnection
      });
      return;
    }

    // Create and save the new connection request with PENDING status
    const connectionRequest = new ProfileConnectionModel({
      requesterId: profileId,
      receiverId,
      status: 'PENDING',
      message: message || undefined // Only include message if provided
    });

    await connectionRequest.save();

    // Send notification to the receiver about the new connection request
    await notificationService.createProfileConnectionRequestNotification(
      mongoose.Types.ObjectId.createFromHexString(profileId),
      mongoose.Types.ObjectId.createFromHexString(receiverId),
      connectionRequest._id
    );

    // Cast the document to access its properties with TypeScript type safety
    const connectionRequestDoc = connectionRequest as unknown as IProfileConnection & Document;

    // Return success response with connection details
    res.status(201).json({
      success: true,
      message: 'Connection request sent successfully',
      connection: {
        id: connectionRequest._id,
        requesterId: connectionRequestDoc.requesterId,
        receiverId: connectionRequestDoc.receiverId,
        status: connectionRequestDoc.status,
        message: connectionRequestDoc.message,
        createdAt: connectionRequestDoc.createdAt,
        updatedAt: connectionRequestDoc.updatedAt
      }
    });
  } catch (error) {
    // Log the error and return a generic error response
    console.error('Error sending connection request:', error);
    res.status(500).json({ success: false, message: 'Failed to send connection request' });
  }
};

/**
 * Accept a connection request
 *
 * This function allows a profile to accept a pending connection request,
 * updates the connection status, and sends a notification to the requester.
 *
 * @param req - Express request object with connectionId in params and profileId in body
 * @param res - Express response object
 */
export const acceptConnectionRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("🚀 ~ acceptConnectionRequest ~ req.params:", req.params);
    console.log("🚀 ~ acceptConnectionRequest ~ req.body:", req.body);
    console.log("🚀 ~ acceptConnectionRequest ~ req.user:", req.user);
    const { connectionId } = req.params; // ID of the connection to accept
    const { profileId } = req.body; // The profile accepting the request

    // Validate the connection exists in the database
    const connection = await ProfileConnectionModel.findById(connectionId);

    if (!connection) {
      res.status(404).json({ success: false, message: 'Connection request not found' });
      return;
    }

    // Security check: Verify that the accepting profile is the receiver of the request
    const connDoc = connection as unknown as IProfileConnection;
    if (connDoc.receiverId.toString() !== profileId) {
      res.status(403).json({ success: false, message: 'This profile is not the receiver of this connection request' });
      return;
    }

    // Retrieve the profile to verify ownership
    console.log("🚀 ~ acceptConnectionRequest ~ looking for profile with ID:", profileId);
    const profile = await ProfileModel.findById(profileId);
    console.log("🚀 ~ acceptConnectionRequest ~ profile found:", profile ? 'Yes' : 'No');

    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }

    // Security check: Verify the authenticated user owns the accepting profile
    // This prevents users from accepting requests for profiles they don't own
    if (profile.owner.toString() !== (req.user as any)?._id.toString()) {
      res.status(403).json({ success: false, message: 'You are not authorized to use this profile' });
      return;
    }

    // Check if the connection request is already accepted to prevent duplicate actions
    const connDoc2 = connection as unknown as IProfileConnection;
    console.log("🚀 ~ acceptConnectionRequest ~ connection status:", connDoc2.status);
    console.log("🚀 ~ acceptConnectionRequest ~ full connection object:", JSON.stringify(connection, null, 2));
    if (connDoc2.status === 'ACCEPTED') {
      res.status(400).json({ success: false, message: 'Connection request is already accepted' });
      return;
    }

    // Update the connection status to ACCEPTED and record the acceptance time
    const connDoc3 = connection as unknown as IProfileConnection & Document;
    connDoc3.status = 'ACCEPTED';
    connDoc3.acceptedAt = new Date();
    try {
      await connection.save();
      console.log("🚀 ~ acceptConnectionRequest ~ connection saved successfully");

      // Update the profiles' connection lists
      console.log("🚀 ~ acceptConnectionRequest ~ updating profiles' connection lists");

      // Add profiles to each other's connected lists
      // Note: The model references Users, but we're storing Profile IDs
      await ProfileModel.updateOne(
        { _id: connDoc3.requesterId },
        { $addToSet: { 'connections.connected': connDoc3.receiverId } }
      );

      await ProfileModel.updateOne(
        { _id: connDoc3.receiverId },
        { $addToSet: { 'connections.connected': connDoc3.requesterId } }
      );

      console.log("🚀 ~ acceptConnectionRequest ~ profiles' connection lists updated");
    } catch (saveError) {
      console.error("🚀 ~ acceptConnectionRequest ~ error saving connection:", saveError);
      throw saveError;
    }

    // Get requester profile for notification purposes
    const requesterProfile = await ProfileModel.findById(connDoc3.requesterId);
    console.log("🚀 ~ acceptConnectionRequest ~ requesterProfile for notification:", requesterProfile)

    // Send notification to the original requester that their request was accepted
    if (requesterProfile) {
      const connDoc4 = connection as unknown as IProfileConnection;
      await notificationService.createProfileConnectionAcceptedNotification(
        mongoose.Types.ObjectId.createFromHexString(connDoc4.requesterId.toString()),
        mongoose.Types.ObjectId.createFromHexString(connDoc4.receiverId.toString()),
        connection._id
      );
    }

    // Return success response with updated connection details
    res.status(200).json({
      success: true,
      message: 'Connection request accepted successfully',
      connection: {
        id: connection._id,
        requesterId: connDoc3.requesterId.toString(),
        receiverId: connDoc3.receiverId.toString(),
        status: connDoc3.status,
        message: connDoc3.message,
        createdAt: connDoc3.createdAt,
        updatedAt: connDoc3.updatedAt,
        acceptedAt: connDoc3.acceptedAt
      }
    });
  } catch (error) {
    // Log the error and return a generic error response
    console.error('Error accepting connection request:', error);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error).reduce((acc, key) => {
      acc[key] = (error as any)[key];
      return acc;
    }, {} as any), 2));
    res.status(500).json({
      success: false,
      message: 'Failed to accept connection request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Reject a connection request
 *
 * This function allows a profile to reject a pending connection request
 * by updating its status to REJECTED.
 *
 * @param req - Express request object with connectionId in params and profileId in body
 * @param res - Express response object
 */
export const rejectConnectionRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { connectionId } = req.params; // ID of the connection to reject
    const { profileId } = req.body; // The profile rejecting the request

    // Validate the connection exists in the database
    const connection = await ProfileConnectionModel.findById(connectionId);

    if (!connection) {
      res.status(404).json({ success: false, message: 'Connection request not found' });
      return;
    }

    // Security check: Verify that the rejecting profile is the receiver of the request
    const connDoc5 = connection as unknown as IProfileConnection;
    if (connDoc5.receiverId.toString() !== profileId) {
      res.status(403).json({ success: false, message: 'This profile is not the receiver of this connection request' });
      return;
    }

    // Retrieve the profile to verify ownership
    const profile = await ProfileModel.findById(profileId);

    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }

    // Security check: Verify the authenticated user owns the rejecting profile
    if (profile.owner.toString() !== (req.user as any)?._id.toString()) {
      res.status(403).json({ success: false, message: 'You are not authorized to use this profile' });
      return;
    }

    // Check if the connection is in a valid state to be rejected
    // Only PENDING requests can be rejected
    const connectionDoc = connection as unknown as IProfileConnection & Document;
    if (connectionDoc.status !== 'PENDING') {
      res.status(400).json({ success: false, message: `Connection request is already ${connectionDoc.status.toLowerCase()}` });
      return;
    }

    // Update the connection status to REJECTED and record the rejection time
    connectionDoc.status = 'REJECTED';
    connectionDoc.rejectedAt = new Date();
    await connection.save();

    // Return success response with updated connection details
    res.status(200).json({
      success: true,
      message: 'Connection request rejected successfully',
      connection: {
        id: connection._id,
        requesterId: connectionDoc.requesterId,
        receiverId: connectionDoc.receiverId,
        status: connectionDoc.status,
        message: connectionDoc.message,
        createdAt: connectionDoc.createdAt,
        updatedAt: connectionDoc.updatedAt,
        rejectedAt: connectionDoc.rejectedAt
      }
    });
  } catch (error) {
    // Log the error and return a generic error response
    console.error('Error rejecting connection request:', error);
    res.status(500).json({ success: false, message: 'Failed to reject connection request' });
  }
};

/**
 * Block a connection
 *
 * This function allows a profile to block another profile by either
 * creating a new connection with BLOCKED status or updating an existing one.
 *
 * @param req - Express request object with profileId in params and targetProfileId in body
 * @param res - Express response object
 */
export const blockConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { profileId } = req.params; // The profile initiating the block
    const { targetProfileId } = req.body; // The profile to block

    // Verify ownership of the blocking profile
    const profile = await ProfileModel.findById(profileId);

    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }

    // Security check: Verify the authenticated user owns the blocking profile
    if (profile.owner.toString() !== (req.user as any)?._id.toString()) {
      res.status(403).json({ success: false, message: 'You are not authorized to use this profile' });
      return;
    }

    // Verify the target profile exists
    const targetProfile = await ProfileModel.findById(targetProfileId);

    if (!targetProfile) {
      res.status(404).json({ success: false, message: 'Target profile not found' });
      return;
    }

    // Check if any type of connection already exists between these profiles
    let connection = await ProfileConnectionModel.findOne({
      $or: [
        { requesterId: profileId, receiverId: targetProfileId },
        { requesterId: targetProfileId, receiverId: profileId }
      ]
    });

    if (connection) {
      // Update existing connection to blocked status
      const connectionDoc = connection as unknown as IProfileConnection & Document;
      connectionDoc.status = 'BLOCKED';
      connectionDoc.blockedAt = new Date();
      await connection.save();
    } else {
      // Create a new connection with blocked status
      // Note: The blocking profile is always set as the requester
      connection = new ProfileConnectionModel({
        requesterId: profileId,
        receiverId: targetProfileId,
        status: 'BLOCKED',
        blockedAt: new Date()
      });
      await connection.save();
    }

    // Return success response with updated connection details
    const connectionDoc = connection as unknown as IProfileConnection;
    res.status(200).json({
      success: true,
      message: 'Connection blocked successfully',
      connection: {
        id: connection._id,
        requesterId: connectionDoc.requesterId,
        receiverId: connectionDoc.receiverId,
        status: connectionDoc.status,
        createdAt: connectionDoc.createdAt,
        updatedAt: connectionDoc.updatedAt,
        blockedAt: connectionDoc.blockedAt
      }
    });
  } catch (error) {
    // Log the error and return a generic error response
    console.error('Error blocking connection:', error);
    res.status(500).json({ success: false, message: 'Failed to block connection' });
  }
};

/**
 * Unblock a connection
 *
 * This function allows a profile to unblock a previously blocked profile
 * by removing the connection entirely.
 *
 * @param req - Express request object with connectionId in params and profileId in body
 * @param res - Express response object
 */
export const unblockConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { connectionId } = req.params; // ID of the blocked connection
    const { profileId } = req.body; // The profile unblocking the connection

    // Validate the connection exists in the database
    const connection = await ProfileConnectionModel.findById(connectionId);

    if (!connection) {
      res.status(404).json({ success: false, message: 'Connection not found' });
      return;
    }

    // Security check: Only the profile that created the block (requester) can unblock
    const connDoc6 = connection as unknown as IProfileConnection;
    if (connDoc6.requesterId.toString() !== profileId) {
      res.status(403).json({ success: false, message: 'This profile did not create this block' });
      return;
    }

    // Verify ownership of the unblocking profile
    const profile = await ProfileModel.findById(profileId);

    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }

    // Security check: Verify the authenticated user owns the unblocking profile
    if (profile.owner.toString() !== (req.user as any)?._id.toString()) {
      res.status(403).json({ success: false, message: 'You are not authorized to use this profile' });
      return;
    }

    // Verify the connection is actually in BLOCKED status
    const connectionDoc = connection as unknown as IProfileConnection;
    if (connectionDoc.status !== 'BLOCKED') {
      res.status(400).json({ success: false, message: 'This connection is not blocked' });
      return;
    }

    // Delete the connection completely to unblock
    // This allows the profiles to reconnect fresh if desired
    await ProfileConnectionModel.findByIdAndDelete(connectionId);

    // Return success response without connection details since it was deleted
    res.status(200).json({
      success: true,
      message: 'Connection unblocked successfully'
    });
  } catch (error) {
    // Log the error and return a generic error response
    console.error('Error unblocking connection:', error);
    res.status(500).json({ success: false, message: 'Failed to unblock connection' });
  }
};

/**
 * Get all connections for a profile
 *
 * This function retrieves all connections associated with a profile,
 * with optional filtering by status, and includes related profile information.
 *
 * @param req - Express request object with profileId in params and optional status in query
 * @param res - Express response object
 */
export const getProfileConnections = async (req: Request, res: Response): Promise<void> => {
  try {
    const { profileId } = req.params; // ID of the profile to get connections for
    const { status } = req.query; // Optional status filter (PENDING, ACCEPTED, REJECTED, BLOCKED)

    // Verify ownership of the profile
    const profile = await ProfileModel.findById(profileId);

    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }

    // Security check: Verify the authenticated user owns the profile
    if (profile.owner.toString() !== (req.user as any)?._id.toString()) {
      res.status(403).json({ success: false, message: 'You are not authorized to view connections for this profile' });
      return;
    }

    // Build query to find connections where the profile is either requester or receiver
    const query: any = {
      $or: [
        { requesterId: profileId },
        { receiverId: profileId }
      ]
    };

    // Add status filter if provided
    if (status) {
      query.status = status;
    }

    // Retrieve connections sorted by most recent first
    const connections = await ProfileConnectionModel.find(query).sort({ createdAt: -1 });

    // Collect all profile IDs involved in these connections for efficient batch loading
    const profileIds = new Set<string>();
    connections.forEach(conn => {
      const connectionDoc = conn as unknown as IProfileConnection;
      profileIds.add(connectionDoc.requesterId.toString());
      profileIds.add(connectionDoc.receiverId.toString());
    });

    // Fetch all relevant profiles in a single query for efficiency
    const profiles = await ProfileModel.find({
      _id: { $in: Array.from(profileIds) }
    }).select('_id name profileType profileImage');

    // Create a lookup map for quick profile access by ID
    const profileMap = new Map();
    profiles.forEach(p => {
      if (p._id) {
        profileMap.set(p._id.toString(), {
          id: p._id,
          name: p.name,
          profileType: p.profileType,
          profileImage: p.profileImage
        });
      }
    });

    // Format each connection with profile details for both requester and receiver
    const formattedConnections = connections.map(conn => {
      const connectionDoc = conn as unknown as IProfileConnection;
      const requesterProfile = profileMap.get(connectionDoc.requesterId.toString());
      const receiverProfile = profileMap.get(connectionDoc.receiverId.toString());

      return {
        id: conn._id.toString(),
        requesterId: connectionDoc.requesterId.toString(),
        receiverId: connectionDoc.receiverId.toString(),
        status: connectionDoc.status,
        message: connectionDoc.message,
        createdAt: connectionDoc.createdAt,
        updatedAt: connectionDoc.updatedAt,
        acceptedAt: connectionDoc.acceptedAt,
        rejectedAt: connectionDoc.rejectedAt,
        blockedAt: connectionDoc.blockedAt,
        requesterProfile,
        receiverProfile
      };
    }) as ProfileConnectionResponse[];

    // Return success response with formatted connections
    res.status(200).json({
      success: true,
      connections: formattedConnections
    });
  } catch (error) {
    // Log the error and return a generic error response
    console.error('Error getting profile connections:', error);
    res.status(500).json({ success: false, message: 'Failed to get profile connections' });
  }
};

/**
 * Check if two profiles are connected
 *
 * This function verifies if there is an ACCEPTED connection between two profiles.
 *
 * @param req - Express request object with profileId and targetProfileId in params
 * @param res - Express response object
 */
export const checkProfilesConnected = async (req: Request, res: Response): Promise<void> => {
  try {
    const { profileId, targetProfileId } = req.params; // IDs of the two profiles to check

    // Search for an ACCEPTED connection between the profiles in either direction
    const connection = await ProfileConnectionModel.findOne({
      $or: [
        { requesterId: profileId, receiverId: targetProfileId },
        { requesterId: targetProfileId, receiverId: profileId }
      ],
      status: 'ACCEPTED'
    });

    // Return success response with connection status and details if found
    res.status(200).json({
      success: true,
      connected: !!connection, // Boolean indicating if they are connected
      connection: connection ? {
        id: connection._id,
        requesterId: (connection as unknown as IProfileConnection).requesterId,
        receiverId: (connection as unknown as IProfileConnection).receiverId,
        status: (connection as unknown as IProfileConnection).status,
        createdAt: (connection as unknown as IProfileConnection).createdAt,
        updatedAt: (connection as unknown as IProfileConnection).updatedAt,
        acceptedAt: (connection as unknown as IProfileConnection).acceptedAt
      } : null
    });
  } catch (error) {
    // Log the error and return a generic error response
    console.error('Error checking profile connection:', error);
    res.status(500).json({ success: false, message: 'Failed to check profile connection' });
  }
};

/**
 * Get connection requests for a profile
 *
 * This function retrieves all PENDING connection requests
 * where the specified profile is the receiver.
 *
 * @param req - Express request object with profileId in params
 * @param res - Express response object
 */
export const getConnectionRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { profileId } = req.params; // ID of the profile to get requests for

    // Verify ownership of the profile
    const profile = await ProfileModel.findById(profileId);

    if (!profile) {
      res.status(404).json({ success: false, message: 'Profile not found' });
      return;
    }

    // Security check: Verify the authenticated user owns the profile
    if (profile.owner.toString() !== (req.user as any)?._id.toString()) {
      res.status(403).json({ success: false, message: 'You are not authorized to view connection requests for this profile' });
      return;
    }

    // Get all pending requests where this profile is the receiver
    // This represents incoming connection requests that need action
    const connectionRequests = await ProfileConnectionModel.find({
      receiverId: profileId,
      status: 'PENDING'
    }).sort({ createdAt: -1 });

    // Get details about all requester profiles for UI display
    const requesterIds = connectionRequests.map(req => (req as unknown as IProfileConnection).requesterId);
    const requesterProfiles = await ProfileModel.find({
      _id: { $in: requesterIds }
    }).select('_id name profileType profileImage');

    // Create a lookup map for quick profile access by ID
    const profileMap = new Map();
    requesterProfiles.forEach(p => {
      if (p._id) {
        profileMap.set(p._id.toString(), {
          id: p._id,
          name: p.name,
          profileType: p.profileType,
          profileImage: p.profileImage
        });
      }
    });

    // Format each connection request with requester profile details
    const formattedRequests = connectionRequests.map(req => {
      const reqDoc = req as unknown as IProfileConnection;
      return {
        id: req._id.toString(),
        requesterId: reqDoc.requesterId.toString(),
        receiverId: reqDoc.receiverId.toString(),
        status: reqDoc.status,
        message: reqDoc.message,
        createdAt: reqDoc.createdAt,
        updatedAt: reqDoc.updatedAt,
        requesterProfile: profileMap.get(reqDoc.requesterId.toString())
      };
    });

    // Return success response with formatted requests
    res.status(200).json({
      success: true,
      connectionRequests: formattedRequests
    });
  } catch (error) {
    // Log the error and return a generic error response
    console.error('Error getting connection requests:', error);
    res.status(500).json({ success: false, message: 'Failed to get connection requests' });
  }
};

/**
 * Get connected profiles
 *
 * This function retrieves all profiles that have an ACCEPTED connection
 * with the specified profile.
 *
 * @param req - Express request object with profileId in params
 * @param res - Express response object
 */
export const getConnectedProfiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { profileId } = req.params; // ID of the profile to find connections for

    // Get all accepted connections where this profile is either requester or receiver
    const connections = await ProfileConnectionModel.find({
      $or: [
        { requesterId: profileId },
        { receiverId: profileId }
      ],
      status: 'ACCEPTED'
    });

    // For each connection, determine the ID of the other profile
    // (the one that's not the profile we're looking for)
    const connectedProfileIds = connections.map(conn => {
      const connDoc = conn as unknown as IProfileConnection;
      return connDoc.requesterId.toString() === profileId ?
        connDoc.receiverId.toString() :
        connDoc.requesterId.toString();
    });

    // Retrieve the details of all connected profiles with selected fields
    // Include relevant profile data for UI display purposes
    const connectedProfiles = await ProfileModel.find({
      _id: { $in: connectedProfileIds }
    }).select('_id name profileType profileCategory profileImage description');

    // Return success response with formatted profiles
    res.status(200).json({
      success: true,
      connectedProfiles: connectedProfiles.map(p => ({
        id: p._id,
        name: p.name,
        profileType: p.profileType,
        profileCategory: p.profileCategory,
        profileImage: p.profileImage,
        description: p.description
      }))
    });
  } catch (error) {
    // Log the error and return a generic error response
    console.error('Error getting connected profiles:', error);
    res.status(500).json({ success: false, message: 'Failed to get connected profiles' });
  }
};
