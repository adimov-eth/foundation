/**
 * Action Tool for modifying Plexus task state
 *
 * This tool demonstrates batched operations with context constraints,
 * where all actions in a batch operate on the same project
 */

import { ActionToolInteraction } from '@here.build/arrival-mcp';
import type { WorkspacePlexus, WorkspaceRoot, Project } from '../models';
import { Task } from '../models';
import * as z from 'zod';
import invariant from 'tiny-invariant';

interface TaskActionContext {
  projectName: string;
}

export class TasksActionTool extends ActionToolInteraction<TaskActionContext, TaskActionContext & { project: Project }> {
  static readonly name = 'tasks-action';
  readonly description = 'Modify tasks within a specific project. All actions in a batch must operate on the same project.';

  readonly contextSchema = {
    projectName: z.string()
      .describe('Project name - all actions in this batch will operate on this project')
      .transform((name, ctx) => {
        const project = this.root.findProject(name);
        if (!project) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Project "${name}" not found`,
          });
          return z.NEVER;
        }
        // Store loaded project in context for actions
        this.loadingExecutionContext.project = project;
        return name;
      }),
  };

  private get workspace(): WorkspacePlexus {
    return this.context.get('workspace');
  }

  private get root(): WorkspaceRoot {
    return this.context.get('root');
  }

  constructor(...args: any[]) {
    super(...args);

    // Create task
    this.registerAction({
      name: 'create-task',
      description: 'Create a new task in the project',
      context: ['projectName'],
      props: {
        title: z.string().min(1).describe('Task title'),
        description: z.string().optional().describe('Task description'),
        priority: z.number().min(1).max(10).default(5).describe('Task priority (1-10)'),
        tags: z.array(z.string()).default([]).describe('Task tags'),
      },
      handler: async (context, { title, description, priority, tags }) => {
        const task = new Task({
          title,
          description: description ?? null,
          status: 'todo',
          priority,
          createdAt: new Date().toISOString(),
          completedAt: null,
          tags,
        });

        // Plexus transaction for atomic update
        this.workspace.transact(() => {
          context.project.tasks.push(task);
        });

        return {
          success: true,
          taskUuid: task.uuid,
          message: `Created task "${title}" with priority ${priority}`,
        };
      },
    });

    // Update task status
    this.registerAction({
      name: 'update-task-status',
      description: 'Update task status',
      context: ['projectName'],
      props: {
        taskUuid: z.string().describe('Task UUID'),
        status: z.enum(['todo', 'in-progress', 'done']).describe('New status'),
      },
      handler: async (context, { taskUuid, status }) => {
        const task = context.project.tasks.find(t => t.uuid === taskUuid);
        invariant(task, `Task ${taskUuid} not found in project ${context.projectName}`);

        const oldStatus = task.status;

        this.workspace.transact(() => {
          task.status = status;
          if (status === 'done' && !task.completedAt) {
            task.completedAt = new Date().toISOString();
          } else if (status !== 'done') {
            task.completedAt = null;
          }
        });

        return {
          success: true,
          message: `Updated task "${task.title}" status from ${oldStatus} to ${status}`,
        };
      },
    });

    // Update task priority
    this.registerAction({
      name: 'update-task-priority',
      description: 'Update task priority',
      context: ['projectName'],
      props: {
        taskUuid: z.string().describe('Task UUID'),
        priority: z.number().min(1).max(10).describe('New priority (1-10)'),
      },
      handler: async (context, { taskUuid, priority }) => {
        const task = context.project.tasks.find(t => t.uuid === taskUuid);
        invariant(task, `Task ${taskUuid} not found in project ${context.projectName}`);

        const oldPriority = task.priority;

        this.workspace.transact(() => {
          task.priority = priority;
        });

        return {
          success: true,
          message: `Updated task "${task.title}" priority from ${oldPriority} to ${priority}`,
        };
      },
    });

    // Add tag to task
    this.registerAction({
      name: 'add-task-tag',
      description: 'Add a tag to a task',
      context: ['projectName'],
      props: {
        taskUuid: z.string().describe('Task UUID'),
        tag: z.string().describe('Tag to add'),
      },
      handler: async (context, { taskUuid, tag }) => {
        const task = context.project.tasks.find(t => t.uuid === taskUuid);
        invariant(task, `Task ${taskUuid} not found in project ${context.projectName}`);

        if (task.tags.includes(tag)) {
          return {
            success: true,
            message: `Task "${task.title}" already has tag "${tag}"`,
            alreadyExists: true,
          };
        }

        this.workspace.transact(() => {
          task.tags.push(tag);
        });

        return {
          success: true,
          message: `Added tag "${tag}" to task "${task.title}"`,
        };
      },
    });

    // Remove tag from task
    this.registerAction({
      name: 'remove-task-tag',
      description: 'Remove a tag from a task',
      context: ['projectName'],
      props: {
        taskUuid: z.string().describe('Task UUID'),
        tag: z.string().describe('Tag to remove'),
      },
      handler: async (context, { taskUuid, tag }) => {
        const task = context.project.tasks.find(t => t.uuid === taskUuid);
        invariant(task, `Task ${taskUuid} not found in project ${context.projectName}`);

        const index = task.tags.indexOf(tag);
        if (index === -1) {
          return {
            success: true,
            message: `Task "${task.title}" does not have tag "${tag}"`,
            notFound: true,
          };
        }

        this.workspace.transact(() => {
          task.tags.splice(index, 1);
        });

        return {
          success: true,
          message: `Removed tag "${tag}" from task "${task.title}"`,
        };
      },
    });

    // Update task details
    this.registerAction({
      name: 'update-task',
      description: 'Update task title and/or description',
      context: ['projectName'],
      props: {
        taskUuid: z.string().describe('Task UUID'),
        title: z.string().min(1).optional().describe('New title'),
        description: z.string().optional().describe('New description'),
      },
      handler: async (context, { taskUuid, title, description }) => {
        const task = context.project.tasks.find(t => t.uuid === taskUuid);
        invariant(task, `Task ${taskUuid} not found in project ${context.projectName}`);

        invariant(title || description !== undefined, 'Must provide either title or description');

        this.workspace.transact(() => {
          if (title) task.title = title;
          if (description !== undefined) task.description = description;
        });

        return {
          success: true,
          message: `Updated task "${task.title}"`,
        };
      },
    });

    // Delete task
    this.registerAction({
      name: 'delete-task',
      description: 'Delete a task',
      context: ['projectName'],
      props: {
        taskUuid: z.string().describe('Task UUID'),
      },
      handler: async (context, { taskUuid }) => {
        const taskIndex = context.project.tasks.findIndex(t => t.uuid === taskUuid);
        invariant(taskIndex !== -1, `Task ${taskUuid} not found in project ${context.projectName}`);

        const task = context.project.tasks[taskIndex];
        const taskTitle = task.title;

        this.workspace.transact(() => {
          context.project.tasks.splice(taskIndex, 1);
        });

        return {
          success: true,
          message: `Deleted task "${taskTitle}"`,
        };
      },
    });
  }
}
