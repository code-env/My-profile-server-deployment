import mongoose from 'mongoose';
import { IList, List, ListItem } from '../models/List';
import { mapExternalToInternal } from '../utils/visibilityMapper';
import crypto from 'crypto';

class ListService {
  /**
   * Generate a unique shareable link
   */
  private generateUniqueLink(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Create a new list
   */
  async createList(listData: Partial<IList>, userId: string, profileId: string) {
    const list = new List({
      ...listData,
      createdBy: userId,
      profile: profileId,
      visibility: listData.visibility ? mapExternalToInternal(listData.visibility as any) : 'Public',
      shareableLink: this.generateUniqueLink(),
      linkAccess: 'edit'  // Default to edit access for the owner
    });

    await list.save();
    return list.toObject();
  }

  /**
   * Generate a new shareable link for a list
   */
  async generateShareableLink(listId: string, userId: string, profileId: string, access: 'view' | 'edit') {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) {
      throw new Error('List not found or access denied');
    }

    list.shareableLink = this.generateUniqueLink();
    list.linkAccess = access;
    await list.save();

    return list.toObject();
  }

  /**
   * Disable shareable link
   */
  async disableShareableLink(listId: string, userId: string, profileId: string) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) {
      throw new Error('List not found or access denied');
    }

    list.shareableLink = '';
    list.linkAccess = 'none';
    await list.save();

    return list.toObject();
  }

  /**
   * Get list by shareable link
   */
  async getListByShareableLink(shareableLink: string, accessInfo?: { profileId?: string; ipAddress?: string; userAgent?: string }) {
    const list = await List.findOne({ shareableLink })
      .populate('participants', 'profileInformation.username profileType')
      .populate('profile', 'profileInformation.username profileType')
      .populate('likes.profile', 'profileInformation.username profileType')
      .populate('comments.postedBy', 'profileInformation.username profileType')
      .populate('shareHistory.sharedBy', 'profileInformation.username profileType')
      .populate('shareHistory.sharedWith', 'profileInformation.username profileType')
      .populate('accessHistory.accessedBy', 'profileInformation.username profileType')
      .lean();

    if (!list) {
      throw new Error('List not found');
    }

    // Track access if profileId is provided
    if (accessInfo?.profileId) {
      await List.findByIdAndUpdate(list._id, {
        $push: {
          accessHistory: {
            accessedBy: new mongoose.Types.ObjectId(accessInfo.profileId),
            accessedAt: new Date(),
            accessType: list.linkAccess,
            ipAddress: accessInfo.ipAddress,
            userAgent: accessInfo.userAgent
          }
        }
      });
    }

    return list;
  }

  /**
   * Get list by ID
   */
  async getListById(listId: string) {
    const list = await List.findById(listId)
      .populate('participants', 'profileInformation.username profileType')
      .populate('profile', 'profileInformation.username profileType')
      .populate('likes.profile', 'profileInformation.username profileType')
      .populate('comments.postedBy', 'profileInformation.username profileType')
      .populate('shareHistory.sharedBy', 'profileInformation.username profileType')
      .populate('shareHistory.sharedWith', 'profileInformation.username profileType')
      .lean();

    if (!list) {
      throw new Error('List not found');
    }

    // Ensure each item has a proper _id
    list.items = list.items.map(item => ({
      ...item,
      _id: item._id || new mongoose.Types.ObjectId()
    }));

    return list;
  }

  /**
   * Get all lists for a user with filters
   */
  async getUserLists(
    profileId: string,
    filters: {
      type?: string;
      importance?: string;
      relatedTask?: string;
      search?: string;
    } = {}
  ) {
    const query: any = { profile: profileId };

    // Apply filters
    if (filters.type) query.type = filters.type;
    if (filters.importance) query.importance = filters.importance;
    if (filters.relatedTask) query.relatedTask = filters.relatedTask;

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { name: searchRegex },
        { notes: searchRegex },
      ];
    }

    const lists = await List.find(query)
      .sort({ importance: -1, createdAt: -1 })
      .populate('profile', 'profileInformation.username profileType')
      .populate('participants', 'profileInformation.username profileType')
      .lean();

    // Ensure each item in each list has a proper _id
    return lists.map(list => ({
      ...list,
      items: list.items.map(item => ({
        ...item,
        _id: item._id || new mongoose.Types.ObjectId()
      }))
    }));
  }

  /**
   * Update a list
   */
  async updateList(listId: string, userId: string, profileId: string, updateData: Partial<IList>) {
    // Map visibility if provided
    if (updateData.visibility) {
      updateData.visibility = mapExternalToInternal(updateData.visibility as any);
    }

    const list = await List.findOneAndUpdate(
      { _id: listId, profile: profileId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!list) {
      throw new Error('List not found or access denied');
    }

    return list.toObject();
  }

  /**
   * Delete a list
   */
  async deleteList(listId: string, userId: string, profileId: string) {
    const result = await List.deleteOne({ _id: listId, profile: profileId });
    if (result.deletedCount === 0) {
      throw new Error('List not found or access denied');
    }
    return true;
  }

  /**
   * Add an item to a list
   */
  async addListItem(listId: string, userId: string, profileId: string, itemData: ListItem) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) {
      throw new Error('List not found or access denied');
    }
    
    list.items.push(itemData);
    await list.save();
    return list.toObject();
  }

  /**
   * Update a list item
   */
  async updateListItem(
    listId: string,
    userId: string,
    profileId: string,
    itemId: string,
    updateData: Partial<ListItem>
  ) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) throw new Error('List not found or access denied');
    const item = list.items.find((item: ListItem) => item._id?.toString() === itemId);
    if (!item) throw new Error('Item not found');
    Object.assign(item, updateData);
    await list.save();
    return list.toObject();
  }

  /**
   * Delete a list item
   */
  async deleteListItem(listId: string, userId: string, profileId: string, itemId: string) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) throw new Error('List not found or access denied');
    console.log(list.items);
    const item = list.items.find(item => item._id?.toString() === itemId);
    if (!item) throw new Error('Item not found');
    const itemIndex = list.items.indexOf(item);
    list.items.splice(itemIndex, 1);
    await list.save();
    return list.toObject();
  }

  /**
   * Toggle item completion status
   */
  async toggleItemCompletion(listId: string, userId: string, profileId: string, itemId: string) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) throw new Error('List not found or access denied');
    const item = list.items.find((item: ListItem) => item._id?.toString() === itemId);
    if (!item) throw new Error('Item not found');
    item.isCompleted = !item.isCompleted;
    if (item.isCompleted) {
      item.completedAt = new Date();
    } else {
      item.completedAt = undefined;
    }
    await list.save();
    return list.toObject();
  }

  /**
   * Add a comment to a list
   */
  async addListComment(
    listId: string,
    userId: string,
    profileId: string,
    text: string
  ): Promise<IList> {
    const list = await List.findById(listId);
    if (!list) {
      throw new Error('List not found');
    }

    const comment = {
      text,
      postedBy: new mongoose.Types.ObjectId(profileId),
      createdAt: new Date(),
      updatedAt: new Date(),
      likes: []
    };

    list.comments.push(comment);
    await list.save();

    return list.toObject() as IList;
  }

  /**
   * Like a comment on a list
   */
  async likeComment(listId: string, commentIndex: number, userId: string, profileId: string) {
    const list = await List.findById(listId);
    if (!list) throw new Error('List not found');
    if (commentIndex < 0 || commentIndex >= list.comments.length) {
      throw new Error('Comment not found');
    }
    const comment = list.comments[commentIndex];
    const profileIdObj = new mongoose.Types.ObjectId(profileId);
    if (comment.likes.some(id => id.toString() === profileId)) {
      throw new Error('Comment already liked');
    }
    comment.likes.push(profileIdObj);
    await list.save();
    return list.toObject();
  }

  /**
   * Unlike a comment on a list
   */
  async unlikeComment(listId: string, commentIndex: number, userId: string, profileId: string) {
    const list = await List.findById(listId);
    if (!list) throw new Error('List not found');
    if (commentIndex < 0 || commentIndex >= list.comments.length) {
      throw new Error('Comment not found');
    }
    const comment = list.comments[commentIndex];
    const likeIndex = comment.likes.findIndex(id => id.toString() === profileId);
    if (likeIndex === -1) {
      throw new Error('Comment not liked');
    }
    comment.likes.splice(likeIndex, 1);
    await list.save();
    return list.toObject();
  }

  /**
   * Like a list
   */
  async likeList(listId: string, userId: string, profileId: string) {
    const list = await List.findById(listId);
    if (!list) throw new Error('List not found');
    const existingLike = list.likes.find(like => like.profile.toString() === profileId);
    if (existingLike) {
      throw new Error('List already liked');
    }
    list.likes.push({
      profile: new mongoose.Types.ObjectId(profileId),
      createdAt: new Date()
    });
    await list.save();
    return list.toObject();
  }

  /**
   * Unlike a list
   */
  async unlikeList(listId: string, userId: string, profileId: string) {
    const list = await List.findById(listId);
    if (!list) throw new Error('List not found');
    const likeIndex = list.likes.findIndex(like => like.profile.toString() === profileId);
    if (likeIndex === -1) {
      throw new Error('List not liked');
    }
    list.likes.splice(likeIndex, 1);
    await list.save();
    return list.toObject();
  }

  /**
   * Assign an item to a profile
   */
  async assignItemToProfile(listId: string, userId: string, profileId: string, itemId: string, assigneeProfileId: string) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) throw new Error('List not found or access denied');
    const item = list.items.find((item: ListItem) => item._id?.toString() === itemId);
    if (!item) throw new Error('Item not found');
    item.assignedTo = new mongoose.Types.ObjectId(assigneeProfileId);
    await list.save();
    return list.toObject();
  }

  /**
   * Add a participant to a list
   */
  async addParticipant(listId: string, userId: string, profileId: string, participantProfileId: string) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) throw new Error('List not found or access denied');
    if (!list.participants.includes(new mongoose.Types.ObjectId(participantProfileId))) {
      list.participants.push(new mongoose.Types.ObjectId(participantProfileId));
    }
    await list.save();
    return list.toObject();
  }

  /**
   * Remove a participant from a list
   */
  async removeParticipant(listId: string, userId: string, profileId: string, participantProfileId: string) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) throw new Error('List not found or access denied');
    
    // Add to share history before removing
    list.shareHistory.push({
      sharedBy: new mongoose.Types.ObjectId(profileId),
      sharedWith: new mongoose.Types.ObjectId(participantProfileId),
      sharedAt: new Date(),
      action: 'unshared'
    });
    
    list.participants = list.participants.filter(p => p.toString() !== participantProfileId);
    await list.save();
    return list;
  }

  /**
   * Add an attachment to a list item
   */
  async addAttachmentToItem(listId: string, userId: string, profileId: string, itemId: string, attachment: any) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) throw new Error('List not found or access denied');
    const item = list.items.find((item: ListItem) => item._id?.toString() === itemId);
    if (!item) throw new Error('Item not found');
    item.attachments = item.attachments || [];
    item.attachments.push(attachment);
    await list.save();
    return list;
  }

  /**
   * Remove an attachment from a list item
   */
  async removeAttachmentFromItem(listId: string, userId: string, profileId: string, itemIndex: number, attachmentIndex: number) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) throw new Error('List not found or access denied');
    if (itemIndex < 0 || itemIndex >= list.items.length) throw new Error('Invalid item index');
    if (!list.items[itemIndex].attachments || attachmentIndex < 0 || attachmentIndex >= list.items[itemIndex].attachments.length) throw new Error('Invalid attachment index');
    list.items[itemIndex].attachments.splice(attachmentIndex, 1);
    await list.save();
    return list;
  }

  /**
   * Add a sub-task to a list item
   */
  async addSubTask(listId: string, userId: string, profileId: string, itemId: string, subTask: any) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) throw new Error('List not found or access denied');
    const item = list.items.find((item: ListItem) => item._id?.toString() === itemId);
    if (!item) throw new Error('Item not found');
    item.subTasks = item.subTasks || [];
    item.subTasks.push(subTask);
    await list.save();
    return list;
  }

  /**
   * Remove a sub-task from a list item
   */
  async removeSubTask(listId: string, userId: string, profileId: string, itemId: string, subTaskId: string) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) throw new Error('List not found or access denied');
    const item = list.items.find((item: ListItem) => item._id?.toString() === itemId);
    if (!item) throw new Error('Item not found');
    item.subTasks = item.subTasks || [];
    const subTaskIndex = item.subTasks.findIndex((subTask: any) => subTask._id?.toString() === subTaskId);
    if (subTaskIndex === -1) throw new Error('Sub-task not found');
    item.subTasks.splice(subTaskIndex, 1);
    await list.save();
    return list;
  }

  /**
   * Duplicate a list (deep copy)
   */
  async duplicateList(listId: string, userId: string, profileId: string) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) throw new Error('List not found or access denied');
    const newList = new List({
      ...list.toObject(),
      _id: undefined,
      name: list.name + ' (Copy)',
      createdBy: userId,
      profile: profileId,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: list.items.map(item => ({ ...item })),
      likes: [],
      comments: [],
      participants: [],
    });
    await newList.save();
    return newList;
  }

  /**
   * Mark all items as complete
   */
  async checkAllItems(listId: string, userId: string, profileId: string) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) throw new Error('List not found or access denied');
    list.items.forEach(item => {
      item.isCompleted = true;
      item.completedAt = new Date();
    });
    await list.save();
    return list;
  }

  /**
   * Mark all items as incomplete
   */
  async uncheckAllItems(listId: string, userId: string, profileId: string) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) throw new Error('List not found or access denied');
    list.items.forEach(item => {
      item.isCompleted = false;
      item.completedAt = undefined;
    });
    await list.save();
    return list;
  }

  /**
   * Share a list (add participants)
   */
  async shareList(listId: string, userId: string, profileId: string, participantProfileIds: string[]) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) throw new Error('List not found or access denied');
    
    participantProfileIds.forEach(pid => {
      if (!list.participants.some(existing => existing.toString() === pid)) {
        list.participants.push(new mongoose.Types.ObjectId(pid));
        // Add to share history
        list.shareHistory.push({
          sharedBy: new mongoose.Types.ObjectId(profileId),
          sharedWith: new mongoose.Types.ObjectId(pid),
          sharedAt: new Date(),
          action: 'shared'
        });
      }
    });
    
    await list.save();
    return list;
  }

  /**
   * Toggle favorite status of a list
   */
  async toggleFavorite(listId: string, userId: string, profileId: string) {
    const list = await List.findOne({ _id: listId, profile: profileId });
    if (!list) {
      throw new Error('List not found or access denied');
    }

    list.favorite = !list.favorite;
    await list.save();
    return list.toObject();
  }
}

export default new ListService();