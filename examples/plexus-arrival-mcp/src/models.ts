/**
 * Plexus models for collaborative task management
 *
 * These models demonstrate how Plexus enables multiple AI agents
 * to collaborate on shared state through Yjs CRDTs
 */

import { PlexusModel, syncing, Plexus, type PlexusInit } from '@here.build/plexus';
import type * as Y from 'yjs';

/**
 * Task model representing individual work items
 */
@syncing
export class Task extends PlexusModel {
  @syncing accessor title!: string;
  @syncing accessor description!: string | null;
  @syncing accessor status!: 'todo' | 'in-progress' | 'done';
  @syncing accessor priority!: number;
  @syncing accessor createdAt!: string;
  @syncing accessor completedAt!: string | null;
  @syncing.list accessor tags!: string[];

  constructor(props: PlexusInit<Task>) {
    super(props);
  }
}

/**
 * Project model representing a collection of tasks
 */
@syncing
export class Project extends PlexusModel {
  @syncing accessor name!: string;
  @syncing accessor description!: string | null;
  @syncing.child.list accessor tasks!: Task[];
  @syncing accessor createdAt!: string;

  constructor(props: PlexusInit<Project>) {
    super(props);
  }

  /**
   * Computed property: count tasks by status
   */
  get taskStats() {
    return {
      total: this.tasks.length,
      todo: this.tasks.filter(t => t.status === 'todo').length,
      inProgress: this.tasks.filter(t => t.status === 'in-progress').length,
      done: this.tasks.filter(t => t.status === 'done').length,
    };
  }

  /**
   * Get high priority tasks (priority >= 7)
   */
  get highPriorityTasks() {
    return this.tasks.filter(t => t.priority >= 7);
  }
}

/**
 * Root model - the entry point to the collaborative state tree
 */
@syncing
export class WorkspaceRoot extends PlexusModel {
  @syncing.child.list accessor projects!: Project[];

  constructor(props?: PlexusInit<WorkspaceRoot>) {
    super(props);
  }

  /**
   * Get all tasks across all projects
   */
  get allTasks(): Task[] {
    return this.projects.flatMap(p => p.tasks);
  }

  /**
   * Find project by name
   */
  findProject(name: string): Project | undefined {
    return this.projects.find(p => p.name === name);
  }

  /**
   * Find task by UUID across all projects
   */
  findTask(uuid: string): { project: Project; task: Task } | undefined {
    for (const project of this.projects) {
      const task = project.tasks.find(t => t.uuid === uuid);
      if (task) {
        return { project, task };
      }
    }
    return undefined;
  }
}

/**
 * Workspace Plexus - manages the collaborative document
 */
export class WorkspacePlexus extends Plexus {
  createDefaultRoot() {
    // Create deterministic default state
    return new WorkspaceRoot({
      projects: [],
    });
  }
}

/**
 * Helper to serialize task for scheme/JSON
 */
export function serializeTask(task: Task) {
  return {
    uuid: task.uuid,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
    tags: [...task.tags],
  };
}

/**
 * Helper to serialize project for scheme/JSON
 */
export function serializeProject(project: Project) {
  return {
    uuid: project.uuid,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt,
    taskCount: project.tasks.length,
    stats: project.taskStats,
    tasks: project.tasks.map(serializeTask),
  };
}
