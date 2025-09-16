import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Define the Task interface
interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Create router
const router = express.Router();

// File path for storing tasks
const TASKS_FILE = path.join(__dirname, 'tasks.json');

// Helper function to read tasks from file
const readTasksFromFile = (): Task[] => {
  try {
    if (!fs.existsSync(TASKS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(TASKS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading tasks file:', error);
    return [];
  }
};

// Helper function to write tasks to file
const writeTasksToFile = (tasks: Task[]): void => {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
  } catch (error) {
    console.error('Error writing tasks file:', error);
    throw new Error('Failed to save tasks');
  }
};

// GET /tasks - Retrieve all tasks
router.get('/', (req: express.Request, res: express.Response) => {
  try {
    const tasks = readTasksFromFile();
    res.status(200).json({
      success: true,
      data: tasks,
      count: tasks.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tasks',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /tasks/:id - Retrieve a specific task by ID
router.get('/:id', (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const tasks = readTasksFromFile();
    const task = tasks.find(t => t.id === id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve task',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /tasks - Create a new task
router.post('/', (req: express.Request, res: express.Response) => {
  try {
    const { title, description } = req.body;
    
    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }
    
    // Create new task
    const newTask: Task = {
      id: uuidv4(),
      title,
      description: description || '',
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Read existing tasks
    const tasks = readTasksFromFile();
    
    // Add new task
    tasks.push(newTask);
    
    // Save tasks to file
    writeTasksToFile(tasks);
    
    res.status(201).json({
      success: true,
      data: newTask,
      message: 'Task created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create task',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /tasks/:id - Update a task
router.put('/:id', (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    const { title, description, completed } = req.body;
    
    // Read existing tasks
    const tasks = readTasksFromFile();
    
    // Find task index
    const taskIndex = tasks.findIndex(t => t.id === id);
    
    if (taskIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Update task
    const updatedTask: Task = {
      ...tasks[taskIndex],
      title: title || tasks[taskIndex].title,
      description: description !== undefined ? description : tasks[taskIndex].description,
      completed: completed !== undefined ? completed : tasks[taskIndex].completed,
      updatedAt: new Date()
    };
    
    // Update tasks array
    tasks[taskIndex] = updatedTask;
    
    // Save tasks to file
    writeTasksToFile(tasks);
    
    res.status(200).json({
      success: true,
      data: updatedTask,
      message: 'Task updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update task',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /tasks/:id - Delete a task
router.delete('/:id', (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;
    
    // Read existing tasks
    const tasks = readTasksFromFile();
    
    // Find task index
    const taskIndex = tasks.findIndex(t => t.id === id);
    
    if (taskIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Remove task
    const deletedTask = tasks.splice(taskIndex, 1)[0];
    
    // Save tasks to file
    writeTasksToFile(tasks);
    
    res.status(200).json({
      success: true,
      data: deletedTask,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete task',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;