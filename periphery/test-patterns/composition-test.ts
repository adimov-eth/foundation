// Test: Full composition chain
// Before: class Task extends PlexusModel
// After: class PlexusTask extends PlexusModel
// Verify: Inheritance graph shows PlexusTask -> PlexusModel

class PlexusModel {
    // Base
}

export class Task extends PlexusModel {
    execute(): void {
        console.log('task');
    }
}

export class Team extends PlexusModel {
    members: string[];
}

// This should NOT be renamed (doesn't extend PlexusModel)
export class Helper {
    help(): void {}
}
