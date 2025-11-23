/**
 * Discovery Tool for exploring Plexus task state with sandboxed Scheme
 *
 * This tool demonstrates how AI agents can explore collaborative state
 * without side effects using Arrival's sandboxed Scheme environment
 */

import { DiscoveryToolInteraction } from '@here.build/arrival-mcp';
import type { WorkspacePlexus, WorkspaceRoot } from '../models';
import { serializeProject, serializeTask } from '../models';
import * as z from 'zod';

export class TasksDiscoveryTool extends DiscoveryToolInteraction<{}> {
  static readonly name = 'tasks-discovery';
  readonly description = 'Explore workspace tasks and projects using Scheme expressions';

  /**
   * Get workspace from Hono context
   */
  private get workspace(): WorkspacePlexus {
    return this.context.get('workspace');
  }

  private get root(): WorkspaceRoot {
    return this.context.get('root');
  }

  /**
   * Register domain functions available in Scheme sandbox
   */
  protected registerFunctions(): void {
    // Project operations
    this.registerFunction(
      'all-projects',
      'Get all projects in the workspace',
      [],
      () => this.root.projects.map(serializeProject)
    );

    this.registerFunction(
      'get-project',
      'Get project by name',
      [z.string().describe('Project name')],
      (name: string) => {
        const project = this.root.findProject(name);
        return project ? serializeProject(project) : null;
      }
    );

    this.registerFunction(
      'get-project-by-uuid',
      'Get project by UUID',
      [z.string().describe('Project UUID')],
      (uuid: string) => {
        const project = this.root.projects.find(p => p.uuid === uuid);
        return project ? serializeProject(project) : null;
      }
    );

    // Task operations
    this.registerFunction(
      'all-tasks',
      'Get all tasks across all projects',
      [],
      () => this.root.allTasks.map(serializeTask)
    );

    this.registerFunction(
      'project-tasks',
      'Get all tasks for a specific project',
      [z.string().describe('Project name')],
      (projectName: string) => {
        const project = this.root.findProject(projectName);
        return project ? project.tasks.map(serializeTask) : [];
      }
    );

    this.registerFunction(
      'get-task',
      'Get task by UUID',
      [z.string().describe('Task UUID')],
      (uuid: string) => {
        const result = this.root.findTask(uuid);
        return result ? serializeTask(result.task) : null;
      }
    );

    this.registerFunction(
      'tasks-by-status',
      'Get all tasks with specific status',
      [z.enum(['todo', 'in-progress', 'done']).describe('Task status')],
      (status: 'todo' | 'in-progress' | 'done') => {
        return this.root.allTasks
          .filter(t => t.status === status)
          .map(serializeTask);
      }
    );

    this.registerFunction(
      'high-priority-tasks',
      'Get all high priority tasks (priority >= 7)',
      [],
      () => {
        return this.root.allTasks
          .filter(t => t.priority >= 7)
          .map(serializeTask);
      }
    );

    this.registerFunction(
      'tasks-by-tag',
      'Get all tasks with a specific tag',
      [z.string().describe('Tag name')],
      (tag: string) => {
        return this.root.allTasks
          .filter(t => t.tags.includes(tag))
          .map(serializeTask);
      }
    );

    // Statistics
    this.registerFunction(
      'workspace-stats',
      'Get overall workspace statistics',
      [],
      () => {
        const allTasks = this.root.allTasks;
        return {
          projectCount: this.root.projects.length,
          totalTasks: allTasks.length,
          tasksByStatus: {
            todo: allTasks.filter(t => t.status === 'todo').length,
            inProgress: allTasks.filter(t => t.status === 'in-progress').length,
            done: allTasks.filter(t => t.status === 'done').length,
          },
          averagePriority: allTasks.length > 0
            ? allTasks.reduce((sum, t) => sum + t.priority, 0) / allTasks.length
            : 0,
          highPriorityCount: allTasks.filter(t => t.priority >= 7).length,
        };
      }
    );

    this.registerFunction(
      'project-stats',
      'Get statistics for a specific project',
      [z.string().describe('Project name')],
      (projectName: string) => {
        const project = this.root.findProject(projectName);
        if (!project) return null;

        return {
          name: project.name,
          uuid: project.uuid,
          ...project.taskStats,
          averagePriority: project.tasks.length > 0
            ? project.tasks.reduce((sum, t) => sum + t.priority, 0) / project.tasks.length
            : 0,
        };
      }
    );
  }
}
