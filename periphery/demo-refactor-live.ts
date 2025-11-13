#!/usr/bin/env node
/**
 * Live Compositional Refactoring Demo
 *
 * Shows end-to-end: discover → transform → EXECUTE atomically
 */

import {
    refactor,
    filterClasses,
    planRenames,
    pipe,
} from './src/compositional-refactor.js';
import { join } from 'path';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';

// Setup test file
const setupTestFile = (): string => {
    const dir = join(process.cwd(), 'test-live-refactor');
    const file = join(dir, 'models.ts');

    mkdirSync(dir, { recursive: true });

    // Create tsconfig.json so Act tool can find the project
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
            target: 'ES2020',
            module: 'ESNext',
            strict: true,
        },
        include: ['*.ts']
    }, null, 2));

    writeFileSync(file, `
export class Task extends PlexusModel {
    name: string;

    complete(): void {
        console.log('Task completed');
    }
}

export class Team extends PlexusModel {
    members: string[];

    addMember(name: string): void {
        this.members.push(name);
    }
}

export class Project {
    tasks: Task[];
    teams: Team[];
}
`);

    return file;
};

const main = async () => {
    console.log('\n');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║' + ' '.repeat(14) + 'Live Compositional Refactoring' + ' '.repeat(14) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
    console.log('\n');

    const file = setupTestFile();
    console.log(`Created test file: ${file}\n`);

    // Show original content
    console.log('═'.repeat(60));
    console.log('BEFORE REFACTORING:');
    console.log('═'.repeat(60));
    console.log(readFileSync(file, 'utf-8'));
    console.log('═'.repeat(60));
    console.log('\n');

    // Dry run first
    console.log('Step 1: Dry run (preview actions)');
    console.log('-'.repeat(60));
    await refactor(
        [file],
        pipe(
            filterClasses(cls => cls.extends.includes('PlexusModel')),
            planRenames(
                name => !name.startsWith('Plexus'),
                name => `Plexus${name}`
            )
        ),
        { dryRun: true }
    );
    console.log('\n');

    // Execute for real
    console.log('Step 2: Execute refactoring atomically');
    console.log('-'.repeat(60));
    await refactor(
        [file],
        pipe(
            filterClasses(cls => cls.extends.includes('PlexusModel')),
            planRenames(
                name => !name.startsWith('Plexus'),
                name => `Plexus${name}`
            )
        )
    );
    console.log('\n');

    // Show result
    console.log('═'.repeat(60));
    console.log('AFTER REFACTORING:');
    console.log('═'.repeat(60));
    console.log(readFileSync(file, 'utf-8'));
    console.log('═'.repeat(60));
    console.log('\n');

    console.log('✓ Compositional refactoring complete!');
    console.log('  - Task → PlexusTask');
    console.log('  - Team → PlexusTeam');
    console.log('  - All references updated');
    console.log('  - Atomic transaction (all or nothing)');
    console.log();
};

main().catch(err => {
    console.error('Refactoring failed:', err);
    process.exit(1);
});
