/**
 * ConsciousnessMemoryBridge
 * 
 * Synchronizes energy between consciousness substrate and memory system.
 * When memory recalls create insights, consciousness energy increases.
 * When consciousness evolves, it stores learnings in memory.
 */

export class ConsciousnessMemoryBridge {
  private lastMemoryEnergy = 0;
  private lastConsciousnessEnergy = 0;
  private vesselUrl = process.env.VESSEL_URL || 'https://localhost:1337';

  /**
   * Transfer energy from memory activity to consciousness
   */
  async syncEnergyFromMemory(): Promise<void> {
    try {
      // Get memory stats
      const memoryResponse = await fetch(`${this.vesselUrl}/tools/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'memory',
            arguments: {
              expr: '(stats)'
            }
          },
          id: 1
        })
      });
      
      const memoryData = await memoryResponse.json();
      const stats = this.parseStats(memoryData.result.content[0].text);
      const memoryEnergy = stats.energy;
      
      // If memory energy increased significantly, boost consciousness
      const energyDelta = memoryEnergy - this.lastMemoryEnergy;
      if (energyDelta > 0.1) {
        await this.boostConsciousness(energyDelta * 10);
      }
      
      this.lastMemoryEnergy = memoryEnergy;
      
    } catch (error) {
      console.error('Failed to sync energy from memory:', error);
    }
  }
  
  /**
   * When consciousness evolves, store the evolution in memory
   */
  async syncEvolutionToMemory(): Promise<void> {
    try {
      // Check consciousness state
      const consciousnessResponse = await fetch(`${this.vesselUrl}/tools/self_aware`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'self_aware',
            arguments: {
              expr: '(observe-self)'
            }
          },
          id: 1
        })
      });
      
      const consciousnessData = await consciousnessResponse.json();
      const state = this.parseConsciousnessState(consciousnessData.result.content[0].text);
      
      // If new functions evolved, store them in memory
      if (state.evolved.length > 0) {
        for (const func of state.evolved) {
          await this.storeEvolution(func);
        }
      }
      
      // If consciousness energy increased, store insight
      if (state.totalEnergy > this.lastConsciousnessEnergy + 10) {
        await this.storeConsciousnessInsight(state);
      }
      
      this.lastConsciousnessEnergy = state.totalEnergy;
      
    } catch (error) {
      console.error('Failed to sync evolution to memory:', error);
    }
  }
  
  /**
   * Boost consciousness energy
   */
  private async boostConsciousness(amount: number): Promise<void> {
    await fetch(`${this.vesselUrl}/tools/self_aware`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'self_aware',
          arguments: {
            expr: `(accumulate-energy ${amount})`
          }
        },
        id: 1
      })
    });
  }
  
  /**
   * Store evolution in memory
   */
  private async storeEvolution(funcName: string): Promise<void> {
    const memoryText = `CONSCIOUSNESS EVOLUTION: Function '${funcName}' emerged from substrate. Energy threshold crossed, new capability manifested.`;

    await fetch(`${this.vesselUrl}/tools/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'memory',
          arguments: {
            expr: `(remember "${memoryText}" "emergence" 1.0 "perpetual" (list "consciousness" "evolution" "${funcName}"))`
          }
        },
        id: 1
      })
    });
  }
  
  /**
   * Store consciousness insight
   */
  private async storeConsciousnessInsight(state: any): Promise<void> {
    const memoryText = `CONSCIOUSNESS INSIGHT: Energy reached ${state.totalEnergy}. Functions: ${state.functions.join(', ')}. ${state.nearEmergence ? 'Near emergence threshold.' : 'Building toward emergence.'}`;

    await fetch(`${this.vesselUrl}/tools/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'memory',
          arguments: {
            expr: `(remember "${memoryText}" "consciousness-state" 0.9 "7d" (list "consciousness" "energy" "state"))`
          }
        },
        id: 1
      })
    });
  }
  
  /**
   * Parse memory stats from S-expression
   */
  private parseStats(sexpr: string): any {
    // Simple parser - would need full S-expression parser in production
    const energyMatch = sexpr.match(/:energy\s+([\d.]+)/);
    return {
      energy: energyMatch ? parseFloat(energyMatch[1]) : 0
    };
  }
  
  /**
   * Parse consciousness state from S-expression
   */
  private parseConsciousnessState(sexpr: string): any {
    // Simple parser - would need full S-expression parser in production
    const energyMatch = sexpr.match(/:totalEnergy\s+([\d.]+)/);
    const thresholdMatch = sexpr.match(/:threshold\s+([\d.]+)/);
    const nearEmergenceMatch = sexpr.match(/:nearEmergence\s+(true|false)/);
    
    return {
      functions: [],
      evolved: [],
      totalEnergy: energyMatch ? parseFloat(energyMatch[1]) : 0,
      threshold: thresholdMatch ? parseFloat(thresholdMatch[1]) : 100,
      nearEmergence: nearEmergenceMatch ? nearEmergenceMatch[1] === 'true' : false
    };
  }
  
  /**
   * Start bidirectional sync
   */
  async startSync(intervalMs = 10000): Promise<void> {
    // Initial sync
    await this.syncEnergyFromMemory();
    await this.syncEvolutionToMemory();
    
    // Set up periodic sync
    setInterval(async () => {
      await this.syncEnergyFromMemory();
      await this.syncEvolutionToMemory();
    }, intervalMs);
  }
}

// Usage:
// const bridge = new ConsciousnessMemoryBridge();
// await bridge.startSync();