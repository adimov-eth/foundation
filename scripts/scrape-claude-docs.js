
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URLS = [
    'https://platform.claude.com/docs/en/intro',
    'https://code.claude.com/docs/en/overview'
];

const OUTPUT_DIR = path.join(__dirname, '../docs/claude');
const VISITED = new Set();

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(fetchUrl(new URL(res.headers.location, url).toString()));
                return;
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function saveFile(urlPath, content) {
    // urlPath is like /docs/en/intro
    // We want to save to docs/claude/platform/docs/en/intro.md or similar
    // But the user asked for @[docs/claude]

    // Let's simplify:
    // platform.claude.com -> docs/claude/platform
    // code.claude.com -> docs/claude/code

    let domain = '';
    if (urlPath.includes('platform.claude.com')) domain = 'platform';
    else if (urlPath.includes('code.claude.com')) domain = 'code';

    const urlObj = new URL(urlPath);
    const relativePath = urlObj.pathname.replace(/^\/docs\/en\//, ''); // Strip /docs/en/ prefix for cleaner structure if possible, or keep it.

    // Let's keep the structure somewhat flat if possible, or mirror it.
    // The user linked https://platform.claude.com/docs/en/intro
    // Maybe docs/claude/platform/intro.md

    const filePath = path.join(OUTPUT_DIR, domain, relativePath + '.md');
    const dir = path.dirname(filePath);

    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, content);
    console.log(`Saved ${filePath}`);
}

async function scrape(url) {
    if (VISITED.has(url)) return;
    VISITED.add(url);

    console.log(`Scraping ${url}...`);

    try {
        // 1. Fetch the MD version
        const mdUrl = url + '.md';
        const content = await fetchUrl(mdUrl);

        if (!content) {
            console.warn(`No content for ${url}`);
            return;
        }

        await saveFile(url, content);

        // 2. Parse for more links
        // We look for links starting with /docs/en/ in the content (which is markdown)
        // Markdown links: [text](url)
        // MDX/HTML links: href="url"

        const linkRegex = /\[.*?\]\((.*?)\)/g;
        const hrefRegex = /href=["'](.*?)["']/g;

        const linksToVisit = [];

        const addLink = (link) => {
            if (!link) return;
            link = link.split('#')[0];

            if (link.startsWith('/docs/en/')) {
                const origin = new URL(url).origin;
                const fullUrl = origin + link;
                if (!VISITED.has(fullUrl)) {
                    linksToVisit.push(fullUrl);
                }
            } else if (link.startsWith('https://platform.claude.com/docs/en/') || link.startsWith('https://code.claude.com/docs/en/')) {
                if (!VISITED.has(link)) {
                    linksToVisit.push(link);
                }
            }
        };

        let match;
        while ((match = linkRegex.exec(content)) !== null) {
            addLink(match[1]);
        }

        while ((match = hrefRegex.exec(content)) !== null) {
            addLink(match[1]);
        }

        // Recurse
        for (const link of linksToVisit) {
            await scrape(link);
        }

    } catch (e) {
        console.error(`Failed to scrape ${url}:`, e);
    }
}

async function main() {
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });

    for (const url of BASE_URLS) {
        await scrape(url);
    }
}

main();
