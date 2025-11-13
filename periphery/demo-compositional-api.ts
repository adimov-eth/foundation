#!/usr/bin/env node
/**
 * Compositional Refactoring API Demo
 *
 * Shows the vision: express refactoring as compositional pipeline
 */

import {
    refactor,
    discoverFiles,
    filterClasses,
    planRenames,
    pipe,
    type FileMetadata,
} from './src/compositional-refactor.js';
import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

// Create test files
const setupTestFiles = (): string[] => {
    const dir = join(process.cwd(), 'test-refactor');
    const file1 = join(dir, 'models.ts');
    const file2 = join(dir, 'services.ts');

    // Ensure dir exists
    mkdirSync(dir, { recursive: true });

    writeFileSync(file1, `
export class Task extends PlexusModel {
    name: string;
    complete(): void {}
}

export class Team extends PlexusModel {
    members: string[];
    addMember(): void {}
}

export class Project {
    tasks: Task[];
}
`);

    writeFileSync(file2, `
export class TaskService {
    getTasks(): Task[] {
        return [];
    }
}

export class TeamService {
    getTeams(): Team[] {
        return [];
    }
}
`);

    return [file1, file2];
};

// Demo 1: Simple discovery
const demo1 = async () => {
    console.log('='.repeat(60));
    console.log('Demo 1: Discovery Phase');
    console.log('='.repeat(60));
    console.log();

    const files = setupTestFiles();
    const metadata = discoverFiles(files);

    console.log('Discovered files:\n');
    metadata.forEach(file => {
        console.log(`${file.path}:`);
        console.log(`  Classes: ${file.classes.map(c => c.name).join(', ')}`);
        console.log(`  Functions: ${file.functions.length}`);
        console.log();
    });
};

// Demo 2: Filter + Transform
const demo2 = async () => {
    console.log('='.repeat(60));
    console.log('Demo 2: Filter PlexusModel Classes');
    console.log('='.repeat(60));
    console.log();

    const files = setupTestFiles();
    const metadata = discoverFiles(files);

    const filtered = filterClasses(
        cls => cls.extends.includes('PlexusModel')
    )(metadata);

    console.log('Classes extending PlexusModel:\n');
    filtered.forEach(file => {
        if (file.classes.length > 0) {
            console.log(`${file.path}:`);
            file.classes.forEach(cls => {
                console.log(`  - ${cls.name}`);
                console.log(`    Methods: ${cls.methods.join(', ')}`);
            });
            console.log();
        }
    });
};

// Demo 3: Full compositional pipeline
const demo3 = async () => {
    console.log('='.repeat(60));
    console.log('Demo 3: Compositional Refactoring Pipeline');
    console.log('='.repeat(60));
    console.log();

    const files = setupTestFiles();

    console.log('Refactoring: Add "Plexus" prefix to all PlexusModel subclasses\n');

    await refactor(
        files,
        pipe(
            // Filter to PlexusModel subclasses
            filterClasses(cls => cls.extends.includes('PlexusModel')),
            // Plan renames for classes without Plexus prefix
            planRenames(
                name => !name.startsWith('Plexus'),
                name => `Plexus${name}`
            )
        )
    );
};

// Demo 4: Multiple transformations composed
const demo4 = async () => {
    console.log('\n');
    console.log('='.repeat(60));
    console.log('Demo 4: Chained Transformations');
    console.log('='.repeat(60));
    console.log();

    const files = setupTestFiles();

    console.log('Pipeline:');
    console.log('  1. Find all PlexusModel subclasses');
    console.log('  2. Filter to classes with < 3 methods');
    console.log('  3. Plan renames to add "Simple" prefix\n');

    await refactor(
        files,
        pipe(
            pipe(
                filterClasses(cls => cls.extends.includes('PlexusModel')),
                filterClasses(cls => cls.methods.length < 3)
            ),
            planRenames(
                name => !name.startsWith('Simple'),
                name => `Simple${name}`
            )
        )
    );
};

// Run all demos
const main = async () => {
    console.log('\n');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║' + ' '.repeat(10) + 'Compositional Refactoring Demo' + ' '.repeat(18) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
    console.log('\n');

    await demo1();
    await demo2();
    await demo3();
    await demo4();

    console.log('\n');
    console.log('Next step: Connect to Act tool for atomic execution');
    console.log('Then: S-expression interface for natural composition');
    console.log();
};

main();
