import mongoose from 'mongoose';
import { IList, List, ListItem } from '../models/List';
import { VisibilityType } from '../models/plans-shared';

class ListService {
  /**
   * Create a new list
   */
  async createList(listData: Partial<IList>, userId: string) {
    const list = new List({
      ...listData,
      createdBy: userId,
      visibility: listData.visibility || VisibilityType.Public,
    });

    await list.save();
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
    userId: string,
    filters: {
      type?: string;
      importance?: string;
      relatedTask?: string;
      search?: string;
    } = {}
  ) {
    const query: any = { createdBy: userId };

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
  async updateList(listId: string, userId: string, updateData: Partial<IList>) {
    const list = await List.findOneAndUpdate(
      { _id: listId, createdBy: userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!list) {
      throw new Error('List not found or access denied');
    }

    return list;
  }

  /**
   * Delete a list
   */
  async deleteList(listId: string, userId: string) {
    const result = await List.deleteOne({ _id: listId, createdBy: userId });
    if (result.deletedCount === 0) {
      throw new Error('List not found or access denied');
    }
    return true;
  }

  /**
   * Add an item to a list
   */
  async addListItem(listId: string, userId: string, itemData: ListItem) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
    if (!list) {
      throw new Error('List not found or access denied');
    }
    
    list.items.push(itemData);
    await list.save();
    return list;
  }

  /**
   * Update a list item
   */
  async updateListItem(
    listId: string,
    userId: string,
    itemId: string,
    updateData: Partial<ListItem>
  ) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
    if (!list) throw new Error('List not found or access denied');
    const item = list.items.find((item: ListItem) => item._id?.toString() === itemId);
    if (!item) throw new Error('Item not found');
    Object.assign(item, updateData);
    await list.save();
    return list;
  }

  /**
   * Delete a list item
   */
  async deleteListItem(listId: string, userId: string, itemId: string) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
    if (!list) throw new Error('List not found or access denied');
    console.log(list.items);
    const item = list.items.find(item => item._id?.toString() === itemId);
    if (!item) throw new Error('Item not found');
    const itemIndex = list.items.indexOf(item);
    list.items.splice(itemIndex, 1);
    await list.save();
    return list;
  }

  /**
   * Toggle item completion status
   */
  async toggleItemCompletion(listId: string, userId: string, itemId: string) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
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
    return list;
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

    return list;
  }

  /**
   * Like a comment on a list
   */
  async likeComment(listId: string, commentIndex: number, userId: string, profileId: string) {
    const list = await List.findOne({ _id: listId });
    if (!list) {
      throw new Error('List not found');
    }

    if (commentIndex < 0 || commentIndex >= list.comments.length) {
      throw new Error('Invalid comment index');
    }

    const comment = list.comments[commentIndex];
    const profileIdObj = new mongoose.Types.ObjectId(profileId);

    // Add the like if not already present
    if (!comment.likes.some(id => id.equals(profileIdObj))) {
      comment.likes.push(profileIdObj);
    }

    await list.save();
    return list;
  }

  /**
   * Unlike a comment on a list
   */
  async unlikeComment(listId: string, commentIndex: number, userId: string, profileId: string) {
    const list = await List.findOne({ _id: listId });
    if (!list) {
      throw new Error('List not found');
    }

    if (commentIndex < 0 || commentIndex >= list.comments.length) {
      throw new Error('Invalid comment index');
    }

    const comment = list.comments[commentIndex];
    const profileIdObj = new mongoose.Types.ObjectId(profileId);

    // Remove the like if present
    comment.likes = comment.likes.filter(id => !id.equals(profileIdObj));

    await list.save();
    return list;
  }

  /**
   * Like a list
   */
  async likeList(listId: string, userId: string, profileId: string) {
    const list = await List.findOneAndUpdate(
      { 
        _id: listId,
        'likes.profile': { $ne: new mongoose.Types.ObjectId(profileId) }
      },
      {
        $push: {
          likes: {
            profile: new mongoose.Types.ObjectId(profileId),
            createdAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (!list) {
      throw new Error('List not found or already liked');
    }

    return list;
  }

  /**
   * Unlike a list
   */
  async unlikeList(listId: string, userId: string, profileId: string) {
    const list = await List.findOneAndUpdate(
      { _id: listId },
      {
        $pull: {
          likes: { profile: new mongoose.Types.ObjectId(profileId) }
        }
      },
      { new: true }
    );

    if (!list) {
      throw new Error('List not found');
    }

    return list;
  }

  /**
   * Assign a list item to a profile
   */
  async assignItemToProfile(listId: string, userId: string, itemId: string, profileId: string) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
    if (!list) throw new Error('List not found or access denied');
    const item = list.items.find((item: ListItem) => item._id?.toString() === itemId);
    if (!item) throw new Error('Item not found');
    item.assignedTo = new mongoose.Types.ObjectId(profileId);
    await list.save();
    return list;
  }

  /**
   * Add a participant to a list
   */
  async addParticipant(listId: string, userId: string, profileId: string) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
    if (!list) throw new Error('List not found or access denied');
    if (!list.participants.some(pid => pid.toString() === profileId)) {
      list.participants.push(new mongoose.Types.ObjectId(profileId));
      await list.save();
    }
    return list;
  }

  /**
   * Remove a participant from a list
   */
  async removeParticipant(listId: string, userId: string, profileId: string) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
    if (!list) throw new Error('List not found or access denied');
    list.participants = list.participants.filter(pid => pid.toString() !== profileId);
    await list.save();
    return list;
  }

  /**
   * Add an attachment to a list item
   */
  async addAttachmentToItem(listId: string, userId: string, itemId: string, attachment: any) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
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
  async removeAttachmentFromItem(listId: string, userId: string, itemIndex: number, attachmentIndex: number) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
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
  async addSubTask(listId: string, userId: string, itemId: string, subTask: any) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
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
  async removeSubTask(listId: string, userId: string, itemId: string, subTaskId: string) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
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
  async duplicateList(listId: string, userId: string) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
    if (!list) throw new Error('List not found or access denied');
    const newList = new List({
      ...list.toObject(),
      _id: undefined,
      name: list.name + ' (Copy)',
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
  async checkAllItems(listId: string, userId: string) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
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
  async uncheckAllItems(listId: string, userId: string) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
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
  async shareList(listId: string, userId: string, profileIds: string[]) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
    if (!list) throw new Error('List not found or access denied');
    profileIds.forEach(pid => {
      if (!list.participants.some(existing => existing.toString() === pid)) {
        list.participants.push(new mongoose.Types.ObjectId(pid));
      }
    });
    await list.save();
    return list;
  }
}

export default new ListService();