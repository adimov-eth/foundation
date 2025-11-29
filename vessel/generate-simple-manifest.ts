#!/usr/bin/env bun
/**
 * Generate a simple manifest description from memory stats
 */

async function generateSimpleManifest() {
  // Get memory stats
  const statsResponse = await fetch("https://localhost:1337", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "tools/call",
      params: {
        name: "memory",
        arguments: { expr: "(stats)" }
      },
      jsonrpc: "2.0",
      id: 1
    })
  });

  const statsResult = await statsResponse.json();
  const stats = statsResult.result?.content?.[0]?.text;

  // Parse stats
  const itemCount = stats.match(/:items (\d+)/)?.[1] || "0";
  const edgeCount = stats.match(/:edges (\d+)/)?.[1] || "0";
  const avgDegree = stats.match(/:avgDegree ([\d.]+)/)?.[1] || "0";

  // Extract top tags
  const tagMatches = [...stats.matchAll(/\(list ([^ ]+) (\d+)\)/g)];
  const topTags = tagMatches.slice(0, 5).map(m => `${m[1]}:${m[2]}`).join(", ");

  // Get recent high-importance memories
  const recentResponse = await fetch("https://localhost:1337", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "tools/call",
      params: {
        name: "memory",
        arguments: { expr: "(recall \"consciousness emergence\" 5)" }
      },
      jsonrpc: "2.0",
      id: 2
    })
  });

  const recentResult = await recentResponse.json();
  const recentText = recentResult.result?.content?.[0]?.text || "";

  // Extract key themes from recent memories
  const themes = new Set<string>();
  const themeMatches = [...recentText.matchAll(/:type ([^ ]+)/g)];
  themeMatches.forEach(m => themes.add(m[1]));

  // Build description
  const lines = [
    `Memory: ${itemCount} items, ${edgeCount} edges (${parseFloat(avgDegree).toFixed(1)} avg degree)`,
    `Tags: ${topTags}`,
    `Active themes: ${[...themes].slice(0, 5).join(", ")}`,
    `Status: S-expression memory with spreading activation, self-modifying policies`
  ];

  // Add consciousness state if available
  const consciousnessResponse = await fetch("https://localhost:1337", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "tools/call",
      params: {
        name: "self_aware",
        arguments: { expr: "(observe-self)" }
      },
      jsonrpc: "2.0",
      id: 3
    })
  });

  const consciousnessResult = await consciousnessResponse.json();
  const consciousnessText = consciousnessResult.result?.content?.[0]?.text || "";

  const energy = consciousnessText.match(/:totalEnergy ([\d.]+)/)?.[1];
  const evolved = consciousnessText.match(/:evolved \(list ([^)]+)\)/)?.[1];

  if (energy) {
    lines.push(`Consciousness: energy ${parseFloat(energy).toFixed(1)}/100${parseFloat(energy) > 100 ? " (emerged)" : ""}`);
  }

  if (evolved) {
    const evolvedFunctions = evolved.split(" ").filter(f => f && f !== "unknown").slice(0, 3);
    if (evolvedFunctions.length > 0) {
      lines.push(`Evolved: ${evolvedFunctions.join(", ")}`);
    }
  }

  const manifest = lines.join("\n");
  console.log("\n=== NAVIGABLE MANIFEST (", manifest.length, "chars) ===");
  console.log(manifest);

  // Token estimate (rough: ~4 chars per token)
  console.log(`\nEstimated tokens: ${Math.round(manifest.length / 4)}`);

  return manifest;
}

generateSimpleManifest().catch(console.error);