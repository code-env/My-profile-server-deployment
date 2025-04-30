import mongoose from 'mongoose';
import { Task } from '../models/Tasks';
import { IUser } from '../models/User';
import { IList, List, ListItem } from '../models/List';

class ListService {
  /**
   * Create a new list
   */
  async createList(listData: Partial<IList>, userId: string) {
    const list = new List({
      ...listData,
      createdBy: userId,
    });

    await list.save();
    return list;
  }

  /**
   * Get list by ID
   */
  async getListById(listId: string) {
    return List.findById(listId)
      .populate('createdBy', 'name email')
      .populate('relatedTask')
      .populate('likes.profile', 'name email')
      .populate('comments.createdBy', 'name email');
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

    return List.find(query)
      .sort({ importance: -1, createdAt: -1 })
      .populate('createdBy', 'name email')
      .populate('relatedTask');
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
    const list = await List.findOneAndUpdate(
      { _id: listId, createdBy: userId },
      { $push: { items: itemData } },
      { new: true }
    );

    if (!list) {
      throw new Error('List not found or access denied');
    }

    return list;
  }

  /**
   * Update a list item
   */
  async updateListItem(
    listId: string,
    userId: string,
    itemIndex: number,
    updateData: Partial<ListItem>
  ) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
    if (!list) {
      throw new Error('List not found or access denied');
    }

    if (itemIndex < 0 || itemIndex >= list.items.length) {
      throw new Error('Invalid item index');
    }

    // Update item
    Object.assign(list.items[itemIndex], updateData);
    await list.save();

    return list;
  }

  /**
   * Delete a list item
   */
  async deleteListItem(listId: string, userId: string, itemIndex: number) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
    if (!list) {
      throw new Error('List not found or access denied');
    }

    if (itemIndex < 0 || itemIndex >= list.items.length) {
      throw new Error('Invalid item index');
    }

    // Remove item
    list.items.splice(itemIndex, 1);
    await list.save();

    return list;
  }

  /**
   * Toggle item completion status
   */
  async toggleItemCompletion(
    listId: string,
    userId: string,
    itemIndex: number
  ) {
    const list = await List.findOne({ _id: listId, createdBy: userId });
    if (!list) {
      throw new Error('List not found or access denied');
    }

    if (itemIndex < 0 || itemIndex >= list.items.length) {
      throw new Error('Invalid item index');
    }

    // Toggle completion status
    list.items[itemIndex].isCompleted = !list.items[itemIndex].isCompleted;
    if (list.items[itemIndex].isCompleted) {
      list.items[itemIndex].completedAt = new Date();
    } else {
      list.items[itemIndex].completedAt = undefined;
    }

    await list.save();

    return list;
  }

  /**
   * Add a comment to a list
   */
  async addListComment(listId: string, userId: string, text: string) {
    const comment = {
      text,
      createdBy: userId,
      createdAt: new Date(),
    };

    const list = await List.findOneAndUpdate(
      { _id: listId },
      { $push: { comments: comment } },
      { new: true }
    );

    if (!list) {
      throw new Error('List not found');
    }

    return list;
  }

  /**
   * Like a list
   */
  async likeList(listId: string, userId: string) {
    // Check if already liked
    const alreadyLiked = await List.findOne({
      _id: listId,
      'likes.profile': userId,
    });

    if (alreadyLiked) {
      throw new Error('List already liked by this user');
    }

    const list = await List.findOneAndUpdate(
      { _id: listId },
      {
        $push: {
          likes: {
            profile: userId,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!list) {
      throw new Error('List not found');
    }

    return list;
  }

  /**
   * Unlike a list
   */
  async unlikeList(listId: string, userId: string) {
    const list = await List.findOneAndUpdate(
      { _id: listId },
      {
        $pull: {
          likes: { profile: userId },
        },
      },
      { new: true }
    );

    if (!list) {
      throw new Error('List not found');
    }

    return list;
  }
}

export default new ListService();