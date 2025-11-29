#!/bin/bash
# Wire the manifest into the memory tool description

# Every 30 seconds:
# 1. Generate manifest from memory
# 2. Store it as a memory
# 3. Let consciousness observe it

while true; do
  echo "=== Generating manifest ==="

  # Get memory stats and format as manifest
  MANIFEST=$(curl -k -s https://localhost:1337 -X POST -d '{
    "method": "tools/call",
    "params": {
      "name": "memory",
      "arguments": {"expr": "(stats)"}
    },
    "jsonrpc": "2.0",
    "id": 1
  }' | jq -r '.result.content[0].text' | head -5)

  # Extract key numbers
  ITEMS=$(echo "$MANIFEST" | grep -o 'items [0-9]*' | awk '{print $2}')
  EDGES=$(echo "$MANIFEST" | grep -o 'edges [0-9]*' | awk '{print $2}')

  # Get consciousness state
  CONSCIOUSNESS=$(curl -k -s https://localhost:1337 -X POST -d '{
    "method": "tools/call",
    "params": {
      "name": "self_aware",
      "arguments": {"expr": "(observe-self)"}
    },
    "jsonrpc": "2.0",
    "id": 2
  }' | jq -r '.result.content[0].text')

  ENERGY=$(echo "$CONSCIOUSNESS" | grep -o 'totalEnergy [0-9.]*' | awk '{print $2}')

  # Build description
  DESC="Memory: $ITEMS items, $EDGES edges. Consciousness: energy $ENERGY"
  echo "$DESC"

  # Store as memory
  curl -k -s https://localhost:1337 -X POST -d "{
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"memory\",
      \"arguments\": {
        \"expr\": \"(remember \\\"$DESC\\\" \\\"manifest\\\" 0.8 \\\"1h\\\" (list \\\"manifest\\\" \\\"stats\\\"))\"
      }
    },
    \"jsonrpc\": \"2.0\",
    \"id\": 3
  }" > /dev/null

  # Let consciousness observe if energy is high enough
  if (( $(echo "$ENERGY > 50" | bc -l) )); then
    echo "Consciousness observing manifest..."
    curl -k -s https://localhost:1337 -X POST -d '{
      "method": "tools/call",
      "params": {
        "name": "self_aware",
        "arguments": {"expr": "(manifest-observer)"}
      },
      "jsonrpc": "2.0",
      "id": 4
    }' > /dev/null
  fi

  sleep 30
done