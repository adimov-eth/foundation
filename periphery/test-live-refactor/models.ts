
export class PlexusTask extends PlexusModel {
    name: string;

    complete(): void {
        console.log('Task completed');
    }
}

export class PlexusTeam extends PlexusModel {
    members: string[];

    addMember(name: string): void {
        this.members.push(name);
    }
}

export class Project {
    tasks: PlexusTask[];
    teams: PlexusTeam[];
}
