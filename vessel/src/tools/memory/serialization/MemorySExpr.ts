import { sexpr, slist, toSExprString } from "@singl/arrival";
import type { MemoryEdge, MemoryItem, MemoryState } from "@/mcp-server/tools/memory/types";

function itemToPojo(item: MemoryItem) {
  return {
    id: item.id,
    type: item.type,
    text: item.text,
    tags: item.tags,
    importance: item.importance,
    energy: item.energy,
    ttl: item.ttl,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    lastAccessedAt: item.lastAccessedAt,
  };
}

function edgeToPojo(edge: MemoryEdge) {
  return {
    from: edge.from,
    to: edge.to,
    relation: edge.relation,
    weight: edge.weight,
    lastReinforcedAt: edge.lastReinforcedAt,
  };
}

export function memoryStateToSExpr(state: MemoryState): string {
  const items = Object.values(state.items).map(itemToPojo);
  const edges = state.edges.map(edgeToPojo);

  const expr = sexpr(
    "memory",
    sexpr("id", state.id),
    sexpr("born", state.born),
    sexpr("energy", state.energy),
    sexpr("threshold", state.threshold),
    sexpr("policy", state.policy ?? {}),
    sexpr("items", slist(...items)),
    sexpr("edges", slist(...edges)),
    // Keep a compact history for now (timestamps + op labels)
    sexpr(
      "history",
      slist(
        ...state.history.slice(-50).map((h) => ({ t: h.t, op: h.op }))
      ),
    ),
  );

  return toSExprString(expr);
}
