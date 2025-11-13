class PlexusModel {
    // Base class for testing
}

export class PlexusTask extends PlexusModel {
    execute(): void {
        console.log('executing');
    }
}

export class PlexusTeam extends PlexusModel {
    members: string[];
}

export class Helper {
    static help(): void {
        console.log('helping');
    }
}
