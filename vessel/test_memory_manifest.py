#!/usr/bin/env python3
"""
Test that the memory manifest is being injected into MCP tool descriptions.
This verifies the spec requirement: tool descriptions contain memory context.
"""

import json
import requests
from requests.auth import HTTPBasicAuth

# MCP server endpoint
MCP_URL = "https://localhost:1337/mcp"

# Disable SSL warnings for self-signed cert
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def test_memory_manifest():
    """Test that memory tool description contains manifest"""
    
    print("=" * 60)
    print("TESTING MEMORY MANIFEST IN MCP TOOL DESCRIPTIONS")
    print("=" * 60)
    
    # List tools to get descriptions
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/list"
    }
    
    try:
        response = requests.post(
            MCP_URL,
            json=payload,
            verify=False,  # Skip SSL verification for self-signed cert
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            
            # Find memory tool
            tools = result.get("result", {}).get("tools", [])
            memory_tool = None
            
            for tool in tools:
                if tool.get("name") == "memory":
                    memory_tool = tool
                    break
            
            if memory_tool:
                description = memory_tool.get("description", "")
                print("\nMemory Tool Description:")
                print("-" * 40)
                print(description)
                print("-" * 40)
                
                # Check if description contains manifest elements
                manifest_elements = [
                    "Memory:",  # Stats line
                    "items",    # Item count
                    "edges",    # Edge count
                    "energy",   # Energy level
                    "Communities",  # Community detection
                    "Key nodes",    # Important memories
                    "Topology",     # Graph metrics
                    "Recent"        # Recent activity
                ]
                
                found_elements = []
                for element in manifest_elements:
                    if element in description:
                        found_elements.append(element)
                
                print(f"\nManifest Elements Found: {len(found_elements)}/{len(manifest_elements)}")
                for element in found_elements:
                    print(f"  ✓ {element}")
                
                missing = set(manifest_elements) - set(found_elements)
                if missing:
                    print("\nMissing elements:")
                    for element in missing:
                        print(f"  ✗ {element}")
                
                # Check character count (rough token estimate)
                char_count = len(description)
                token_estimate = char_count / 4  # Rough estimate
                print(f"\nDescription Size:")
                print(f"  Characters: {char_count}")
                print(f"  Estimated tokens: {int(token_estimate)}")
                
                if token_estimate < 600:
                    print("  ✓ Within target token budget (~500)")
                else:
                    print("  ⚠ Exceeds target token budget")
                
                # Success if we found most elements
                if len(found_elements) >= 5:
                    print("\n✓ SUCCESS: Memory manifest is being injected into tool description!")
                    print("  Claude sees this context BEFORE any tool calls.")
                else:
                    print("\n⚠ PARTIAL: Some manifest elements found but not complete.")
                    
            else:
                print("✗ Memory tool not found in tool list")
                
        else:
            print(f"✗ Failed to list tools: HTTP {response.status_code}")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print("✗ Could not connect to MCP server at", MCP_URL)
        print("  Make sure the vessel is running: pm2 status vessel")
    except Exception as e:
        print(f"✗ Error: {e}")

if __name__ == "__main__":
    test_memory_manifest()
    
    print("\n" + "=" * 60)
    print("KEY INSIGHT:")
    print("The MCP protocol itself becomes the memory transport layer.")
    print("Tool descriptions ARE the memory context.")
    print("=" * 60)