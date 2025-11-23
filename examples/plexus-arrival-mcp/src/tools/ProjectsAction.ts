/**
 * Action Tool for managing projects
 *
 * This tool handles project-level operations (create, update, delete projects)
 */

import { ActionToolInteraction } from '@here.build/arrival-mcp';
import type { WorkspacePlexus, WorkspaceRoot } from '../models';
import { Project } from '../models';
import * as z from 'zod';
import invariant from 'tiny-invariant';

export class ProjectsActionTool extends ActionToolInteraction<{}> {
  static readonly name = 'projects-action';
  readonly description = 'Create, update, and delete projects in the workspace';

  readonly contextSchema = {};

  private get workspace(): WorkspacePlexus {
    return this.context.get('workspace');
  }

  private get root(): WorkspaceRoot {
    return this.context.get('root');
  }

  constructor(...args: any[]) {
    super(...args);

    // Create project
    this.registerAction({
      name: 'create-project',
      description: 'Create a new project',
      props: {
        name: z.string().min(1).describe('Project name'),
        description: z.string().optional().describe('Project description'),
      },
      handler: async (context, { name, description }) => {
        // Check if project already exists
        const existing = this.root.findProject(name);
        invariant(!existing, `Project "${name}" already exists`);

        const project = new Project({
          name,
          description: description ?? null,
          createdAt: new Date().toISOString(),
          tasks: [],
        });

        this.workspace.transact(() => {
          this.root.projects.push(project);
        });

        return {
          success: true,
          projectUuid: project.uuid,
          message: `Created project "${name}"`,
        };
      },
    });

    // Update project
    this.registerAction({
      name: 'update-project',
      description: 'Update project name and/or description',
      props: {
        projectName: z.string().describe('Current project name'),
        newName: z.string().min(1).optional().describe('New project name'),
        description: z.string().optional().describe('New description'),
      },
      handler: async (context, { projectName, newName, description }) => {
        const project = this.root.findProject(projectName);
        invariant(project, `Project "${projectName}" not found`);

        invariant(newName || description !== undefined, 'Must provide either newName or description');

        // Check if new name conflicts
        if (newName && newName !== projectName) {
          const existing = this.root.findProject(newName);
          invariant(!existing, `Project "${newName}" already exists`);
        }

        this.workspace.transact(() => {
          if (newName) project.name = newName;
          if (description !== undefined) project.description = description;
        });

        return {
          success: true,
          message: `Updated project "${newName ?? projectName}"`,
        };
      },
    });

    // Delete project
    this.registerAction({
      name: 'delete-project',
      description: 'Delete a project and all its tasks',
      props: {
        projectName: z.string().describe('Project name'),
        confirm: z.literal(true).describe('Must be true to confirm deletion'),
      },
      handler: async (context, { projectName, confirm }) => {
        const projectIndex = this.root.projects.findIndex(p => p.name === projectName);
        invariant(projectIndex !== -1, `Project "${projectName}" not found`);

        const project = this.root.projects[projectIndex];
        const taskCount = project.tasks.length;

        this.workspace.transact(() => {
          this.root.projects.splice(projectIndex, 1);
        });

        return {
          success: true,
          message: `Deleted project "${projectName}" with ${taskCount} task(s)`,
        };
      },
    });
  }
}
