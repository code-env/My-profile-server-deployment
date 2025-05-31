const mongoose = require('mongoose');
require('dotenv').config();

async function queryPendingReminders() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const Event = mongoose.model('Event', new mongoose.Schema({}, { strict: false }));
    const Task = mongoose.model('Task', new mongoose.Schema({}, { strict: false }));
    const List = mongoose.model('List', new mongoose.Schema({}, { strict: false }));
    
    const now = new Date();
    console.log('Current time:', now.toISOString());
    console.log('\n=== PENDING EVENT REMINDERS ===');
    
    const eventReminders = await Event.find({
      'reminders.triggered': false,
      'reminders.triggerTime': { $exists: true }
    }).select('title startTime reminders createdBy');
    
    console.log('Total events with reminders:', eventReminders.length);
    eventReminders.forEach((event, i) => {
      console.log(`\nEvent ${i+1}: ${event.title}`);
      console.log('Start Time:', event.startTime?.toISOString());
      console.log('Created By:', event.createdBy);
      event.reminders?.forEach((reminder, j) => {
        if (!reminder.triggered) {
          console.log(`  Reminder ${j+1}:`);
          console.log(`    Type: ${reminder.type}`);
          console.log(`    Trigger Time: ${reminder.triggerTime?.toISOString()}`);
          console.log(`    Due: ${reminder.triggerTime <= now ? 'YES' : 'NO'}`);
          console.log(`    Triggered: ${reminder.triggered}`);
        }
      });
    });
    
    console.log('\n=== PENDING TASK REMINDERS ===');
    
    const taskReminders = await Task.find({
      'reminders.triggered': false,
      'reminders.triggerTime': { $exists: true }
    }).select('title startTime reminders createdBy');
    
    console.log('Total tasks with reminders:', taskReminders.length);
    taskReminders.forEach((task, i) => {
      console.log(`\nTask ${i+1}: ${task.title}`);
      console.log('Start Time:', task.startTime?.toISOString());
      console.log('Created By:', task.createdBy);
      task.reminders?.forEach((reminder, j) => {
        if (!reminder.triggered) {
          console.log(`  Reminder ${j+1}:`);
          console.log(`    Type: ${reminder.type}`);
          console.log(`    Trigger Time: ${reminder.triggerTime?.toISOString()}`);
          console.log(`    Due: ${reminder.triggerTime <= now ? 'YES' : 'NO'}`);
          console.log(`    Triggered: ${reminder.triggered}`);
        }
      });
    });
    
    console.log('\n=== PENDING LIST ITEM REMINDERS ===');
    
    const listReminders = await List.find({
      'items.reminders.triggered': false,
      'items.reminders.triggerTime': { $exists: true }
    }).select('name items');
    
    console.log('Total lists with item reminders:', listReminders.length);
    listReminders.forEach((list, i) => {
      console.log(`\nList ${i+1}: ${list.name}`);
      list.items?.forEach((item, j) => {
        if (item.reminders && item.reminders.length > 0) {
          console.log(`  Item ${j+1}: ${item.name}`);
          item.reminders.forEach((reminder, k) => {
            if (!reminder.triggered) {
              console.log(`    Reminder ${k+1}:`);
              console.log(`      Type: ${reminder.type}`);
              console.log(`      Trigger Time: ${reminder.triggerTime?.toISOString()}`);
              console.log(`      Due: ${reminder.triggerTime <= now ? 'YES' : 'NO'}`);
              console.log(`      Triggered: ${reminder.triggered}`);
            }
          });
        }
      });
    });
    
    // Summary of due reminders
    console.log('\n=== SUMMARY ===');
    const dueEventReminders = await Event.find({
      'reminders.triggered': false,
      'reminders.triggerTime': { $lte: now }
    });
    
    const dueTaskReminders = await Task.find({
      'reminders.triggered': false,
      'reminders.triggerTime': { $lte: now }
    });
    
    console.log('Due event reminders:', dueEventReminders.length);
    console.log('Due task reminders:', dueTaskReminders.length);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

queryPendingReminders(); 