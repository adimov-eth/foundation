export class PlexusTask extends PlexusModel {
    title: string;

    complete(): void {
        console.log('Task complete');
    }
}

export class PlexusTeam extends PlexusModel {
    name: string;

    addMember(user: string): void {
        console.log(`Adding ${user}`);
    }
}

export class Project {
    tasks: PlexusTask[];
    teams: PlexusTeam[];
}
