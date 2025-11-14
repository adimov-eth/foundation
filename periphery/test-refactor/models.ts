
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
