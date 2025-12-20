/**
 * Q-Learning Implementation with Cloudflare KV Storage
 * 
 * This is a KV-compatible version of qlearning.ts for Cloudflare Workers.
 * Uses KV namespace instead of file system for Q-table persistence.
 */

import { QTable, QLearningConfig, PersistedQTable } from './types';

export class QLearningKV {
  private qTable: QTable = {};
  private config: QLearningConfig;
  private kvNamespace: KVNamespace;
  private kvKey: string;

  constructor(config: QLearningConfig, kvNamespace: KVNamespace, kvKey = 'qtable') {
    this.config = config;
    this.kvNamespace = kvNamespace;
    this.kvKey = kvKey;
  }

  /**
   * Load Q-table from KV storage
   */
  async loadQTable(): Promise<void> {
    try {
      const stored = await this.kvNamespace.get(this.kvKey, 'json') as PersistedQTable | null;
      
      if (stored && stored.qTable) {
        this.qTable = stored.qTable;
        this.config.epsilon = stored.epsilon || this.config.epsilon;
        console.log(`[QLearningKV] Loaded Q-table from KV: ${Object.keys(this.qTable).length} states`);
      } else {
        console.log('[QLearningKV] No existing Q-table in KV, starting fresh');
        this.qTable = {};
      }
    } catch (error) {
      console.error('[QLearningKV] Error loading Q-table from KV:', error);
      this.qTable = {};
    }
  }

  /**
   * Save Q-table to KV storage
   */
  async saveQTable(): Promise<void> {
    try {
      const toSave: PersistedQTable = {
        qTable: this.qTable,
        epsilon: this.config.epsilon,
        lastUpdated: new Date().toISOString(),
        stateCount: Object.keys(this.qTable).length
      };

      await this.kvNamespace.put(this.kvKey, JSON.stringify(toSave));
      console.log(`[QLearningKV] Saved Q-table to KV: ${toSave.stateCount} states`);
    } catch (error) {
      console.error('[QLearningKV] Error saving Q-table to KV:', error);
    }
  }

  /**
   * Get Q-value for a state-action pair
   */
  getQValue(state: string, action: string): number {
    if (!this.qTable[state]) {
      this.qTable[state] = {};
    }
    return this.qTable[state][action] || 0;
  }

  /**
   * Set Q-value for a state-action pair
   */
  setQValue(state: string, action: string, value: number): void {
    if (!this.qTable[state]) {
      this.qTable[state] = {};
    }
    this.qTable[state][action] = value;
  }

  /**
   * Update Q-value using Bellman equation
   * Q(s,a) = Q(s,a) + α * [R + γ * max(Q(s',a')) - Q(s,a)]
   */
  updateQValue(
    state: string,
    action: string,
    reward: number,
    nextState: string,
    possibleActions: string[]
  ): void {
    const currentQ = this.getQValue(state, action);
    
    // Find max Q-value for next state
    const maxNextQ = Math.max(
      ...possibleActions.map(a => this.getQValue(nextState, a))
    );

    // Bellman equation
    const newQ = currentQ + this.config.learningRate * 
      (reward + this.config.discountFactor * maxNextQ - currentQ);
    
    this.setQValue(state, action, newQ);
  }

  /**
   * Select action using epsilon-greedy policy
   */
  selectAction(state: string, possibleActions: string[]): string {
    // Exploration: random action
    if (Math.random() < this.config.epsilon) {
      return possibleActions[Math.floor(Math.random() * possibleActions.length)];
    }

    // Exploitation: best known action
    let bestAction = possibleActions[0];
    let bestValue = this.getQValue(state, bestAction);

    for (const action of possibleActions) {
      const value = this.getQValue(state, action);
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Get all Q-values for a state
   */
  getStateQValues(state: string): Record<string, number> {
    return this.qTable[state] || {};
  }

  /**
   * Decay epsilon (reduce exploration over time)
   */
  decayEpsilon(): void {
    this.config.epsilon = Math.max(
      this.config.minEpsilon || 0.01,
      this.config.epsilon * (this.config.epsilonDecay || 0.995)
    );
  }

  /**
   * Get current Q-table size
   */
  getQTableSize(): number {
    return Object.keys(this.qTable).length;
  }

  /**
   * Get current epsilon
   */
  getEpsilon(): number {
    return this.config.epsilon;
  }

  /**
   * Get the Q-table (for debugging)
   */
  getQTable(): QTable {
    return this.qTable;
  }
}
