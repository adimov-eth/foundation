#!/usr/bin/env bun

/**
 * Export memory graph for visualization
 * 
 * Usage:
 *   bun run export-graph.ts [--format json|dot|cytoscape] [--output file]
 */

import { parseArgs } from "util";
import { promises as fs } from "fs";
import { FileMemoryStore } from "../store/FileMemoryStore";
import type { MemoryState } from "../types";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    format: { type: 'string', default: 'json' },
    output: { type: 'string' },
    help: { type: 'boolean', default: false }
  },
  strict: false,
  allowPositionals: false
});

if (values.help) {
  console.log(`
Memory Graph Export Tool

Export the memory graph in various formats for visualization.

Usage:
  bun run export-graph.ts [options]

Options:
  --format <type>   Output format: json, dot, cytoscape (default: json)
  --output <file>   Output file (default: stdout)
  --help           Show this help

Examples:
  # Export as JSON
  bun run export-graph.ts --format json --output memory-graph.json
  
  # Export as Graphviz DOT
  bun run export-graph.ts --format dot --output memory-graph.dot
  
  # Export for Cytoscape
  bun run export-graph.ts --format cytoscape --output memory-graph.cy.json
`);
  process.exit(0);
}

async function exportGraph() {
  // Load memory state
  const store = new FileMemoryStore();
  const state = await store.load();
  
  if (!state) {
    console.error("No memory state found");
    process.exit(1);
  }
  
  let output: string;
  
  switch (values.format) {
    case 'dot':
      output = exportToDot(state);
      break;
    
    case 'cytoscape':
      output = exportToCytoscape(state);
      break;
    
    case 'json':
    default:
      output = exportToJson(state);
      break;
  }
  
  if (values.output) {
    await fs.writeFile(values.output as string, output, 'utf8');
    console.log(`Exported to ${values.output}`);
  } else {
    console.log(output);
  }
}

function exportToJson(state: MemoryState): string {
  const nodes = Object.values(state.items).map(item => ({
    id: item.id,
    label: item.text.slice(0, 50),
    type: item.type,
    importance: item.importance,
    energy: item.energy,
    tags: item.tags,
    createdAt: item.createdAt,
    accessCount: item.accessCount || 0
  }));
  
  const edges = state.edges.map(edge => ({
    source: edge.from,
    target: edge.to,
    weight: edge.weight,
    relation: edge.relation
  }));
  
  return JSON.stringify({
    nodes,
    edges,
    metadata: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      totalEnergy: state.energy,
      exported: new Date().toISOString()
    }
  }, null, 2);
}

function exportToDot(state: MemoryState): string {
  const lines: string[] = [];
  lines.push('digraph MemoryGraph {');
  lines.push('  rankdir=LR;');
  lines.push('  node [shape=circle, style=filled];');
  lines.push('');
  
  // Color nodes by energy
  for (const item of Object.values(state.items)) {
    const color = getColorForEnergy(item.energy);
    const size = 0.5 + item.importance * 1.5;
    const label = item.text.slice(0, 20).replace(/"/g, '\\"');
    lines.push(`  "${item.id}" [label="${label}", fillcolor="${color}", width=${size}];`);
  }
  
  lines.push('');
  
  // Add edges
  for (const edge of state.edges) {
    const penwidth = 1 + edge.weight * 3;
    lines.push(`  "${edge.from}" -> "${edge.to}" [label="${edge.relation}", penwidth=${penwidth}];`);
  }
  
  lines.push('}');
  return lines.join('\n');
}

function exportToCytoscape(state: MemoryState): string {
  const elements: any[] = [];
  
  // Add nodes
  for (const item of Object.values(state.items)) {
    elements.push({
      data: {
        id: item.id,
        label: item.text.slice(0, 30),
        type: item.type,
        importance: item.importance,
        energy: item.energy,
        tags: item.tags.join(', ')
      },
      classes: item.type
    });
  }
  
  // Add edges
  for (const edge of state.edges) {
    elements.push({
      data: {
        id: `${edge.from}-${edge.to}`,
        source: edge.from,
        target: edge.to,
        weight: edge.weight,
        label: edge.relation
      }
    });
  }
  
  return JSON.stringify({
    elements,
    style: [
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'background-color': '#00ff88',
          'width': 'mapData(importance, 0, 1, 20, 60)',
          'height': 'mapData(importance, 0, 1, 20, 60)'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 'mapData(weight, 0, 1, 1, 5)',
          'line-color': '#00ff88',
          'target-arrow-color': '#00ff88',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': 'data(label)'
        }
      }
    ]
  }, null, 2);
}

function getColorForEnergy(energy: number): string {
  // Gradient from blue (low) to red (high)
  if (energy < 0.33) return '#45b7d1';
  if (energy < 0.66) return '#4ecdc4';
  return '#ff6b6b';
}

// Run export
exportGraph().catch(console.error);