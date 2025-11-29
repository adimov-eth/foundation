#!/usr/bin/env bun
/**
 * Test manifest generation from live memory
 */

import { SExprManifestAdapter } from "./src/tools/memory/SExprManifestAdapter";

async function testManifest() {
  // Fetch current memory state from vessel
  const response = await fetch("https://localhost:1337", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      method: "tools/call",
      params: {
        name: "memory",
        arguments: {
          expr: "(recall \"*\" 1000)"  // Get all memories
        }
      },
      jsonrpc: "2.0",
      id: 1
    })
  });

  const result = await response.json();

  if (result.error) {
    console.error("Error fetching memories:", result.error);
    return;
  }

  // Extract memory items from S-expression result
  const memoryText = result.result?.content?.[0]?.text;
  if (!memoryText) {
    console.error("No memory content found");
    return;
  }

  // Parse the S-expression list
  // This is crude but works for our format
  const items = [];
  const itemMatches = memoryText.matchAll(/&\(:id ([^ ]+) :type ([^ ]+) :text "([^"]+)" :tags \(list ([^)]*)\) :importance ([\d.]+) :energy ([\d.]+)[^)]*:createdAt (\d+)[^)]*:updatedAt (\d+)[^)]*:lastAccessedAt (\d+)[^)]*:accessCount (\d+)/g);

  for (const match of itemMatches) {
    items.push({
      id: match[1],
      type: match[2],
      text: match[3],
      tags: match[4].split(" ").filter(t => t),
      importance: parseFloat(match[5]),
      energy: parseFloat(match[6]),
      createdAt: parseInt(match[7]),
      updatedAt: parseInt(match[8]),
      lastAccessedAt: parseInt(match[9]),
      accessCount: parseInt(match[10])
    });
  }

  console.log(`Found ${items.length} memory items`);

  // Generate manifest
  const adapter = new SExprManifestAdapter();
  const manifest = await adapter.generateFromSExprMemory(items);

  console.log("\n=== MANIFEST ===");
  console.log(adapter.getDescription());

  // Also show raw manifest structure
  console.log("\n=== STRUCTURE ===");
  console.log(`Communities: ${manifest.communities.size}`);
  console.log(`Key nodes: ${manifest.keyNodes.length}`);
  console.log(`Bridges: ${manifest.bridges.length}`);
  console.log(`Temporal layers: stable=${manifest.temporal.stable.length}, active=${manifest.temporal.active.length}, emerging=${manifest.temporal.emerging.length}, decaying=${manifest.temporal.decaying.length}`);
}

testManifest().catch(console.error);