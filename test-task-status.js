#!/usr/bin/env node

/**
 * Simple test script to verify the task status functionality
 */

const Task = require('./src/domain/entities/task');

console.log('Testing Task Entity with 3-status system...\n');

// Test 1: Create a new task with default status
console.log('Test 1: Creating task with default status');
const task1 = new Task('test-1', 'Test task content');
console.log(`Status: ${task1.status}, Completed: ${task1.completed}`);
console.log(`Status text: ${task1.getStatusText()}`);
console.log(`Is todo: ${task1.isTodo()}, Is doing: ${task1.isInProgress()}, Is done: ${task1.isCompleted()}\n`);

// Test 2: Create task with specific status
console.log('Test 2: Creating task with "doing" status');
const task2 = new Task('test-2', 'Another task', 'doing');
console.log(`Status: ${task2.status}, Completed: ${task2.completed}`);
console.log(`Status text: ${task2.getStatusText()}`);
console.log(`Is todo: ${task2.isTodo()}, Is doing: ${task2.isInProgress()}, Is done: ${task2.isCompleted()}\n`);

// Test 3: Update status
console.log('Test 3: Updating task status');
console.log('Before update:', task1.status);
task1.updateStatus('doing');
console.log('After updating to "doing":', task1.status, 'Completed:', task1.completed);
task1.updateStatus('done');
console.log('After updating to "done":', task1.status, 'Completed:', task1.completed);
task1.updateStatus('todo');
console.log('After updating to "todo":', task1.status, 'Completed:', task1.completed);
console.log();

// Test 4: Legacy methods
console.log('Test 4: Testing legacy methods');
task1.markAsInProgress();
console.log('After markAsInProgress():', task1.status);
task1.markAsCompleted();
console.log('After markAsCompleted():', task1.status);
task1.markAsIncomplete();
console.log('After markAsIncomplete():', task1.status);
console.log();

// Test 5: JSON serialization/deserialization
console.log('Test 5: JSON serialization/deserialization');
const task3 = new Task('test-3', 'JSON test task', 'doing');
const jsonData = task3.toJSON();
console.log('Serialized:', JSON.stringify(jsonData, null, 2));

const task4 = Task.fromJSON(jsonData);
console.log('Deserialized status:', task4.status);
console.log('Deserialized completed:', task4.completed);
console.log();

// Test 6: Backward compatibility
console.log('Test 6: Backward compatibility');
const legacyData = {
  id: 'legacy-1',
  content: 'Legacy task',
  completed: true,
  createdAt: new Date().toISOString(),
  reminderTime: null,
  updatedAt: new Date().toISOString()
};

const legacyTask = Task.fromJSON(legacyData);
console.log('Legacy task status:', legacyTask.status);
console.log('Legacy task completed:', legacyTask.completed);

console.log('\n✅ All tests completed successfully!');