/**
 * Web search server tool for the agent framework.
 */

interface UserLocation {
  country?: string;
  region?: string;
  city?: string;
}

interface WebSearchConfig {
  name?: string;
  maxUses?: number;
  allowedDomains?: string[];
  blockedDomains?: string[];
  userLocation?: UserLocation;
}

export class WebSearchServerTool {
  readonly name: string;
  readonly type = "web_search_20250305";
  readonly maxUses?: number;
  readonly allowedDomains?: string[];
  readonly blockedDomains?: string[];
  readonly userLocation?: UserLocation;

  constructor(config: WebSearchConfig = {}) {
    this.name = config.name ?? "web_search";
    this.maxUses = config.maxUses;
    this.allowedDomains = config.allowedDomains;
    this.blockedDomains = config.blockedDomains;
    this.userLocation = config.userLocation;
  }

  toDict(): Record<string, unknown> {
    const toolDict: Record<string, unknown> = {
      type: this.type,
      name: this.name,
    };

    if (this.maxUses !== undefined) {
      toolDict.max_uses = this.maxUses;
    }
    if (this.allowedDomains !== undefined) {
      toolDict.allowed_domains = this.allowedDomains;
    }
    if (this.blockedDomains !== undefined) {
      toolDict.blocked_domains = this.blockedDomains;
    }
    if (this.userLocation !== undefined) {
      toolDict.user_location = this.userLocation;
    }

    return toolDict;
  }
}
