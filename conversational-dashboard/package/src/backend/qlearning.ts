import {
  QLearningConfig,
  PersistedQTable,
} from "./types";
import fs from "fs/promises";
import path from "path";

// Generic Q-Table type (state -> action -> Q-value)
type QTable = Map<string, Map<string, number>>;

// Default hyperparameters
const DEFAULT_CONFIG: QLearningConfig = {
  alpha: 0.1, // Learning rate
  gamma: 0.9, // Discount factor
  epsilon: 0.2, // Exploration rate
  epsilonDecay: 0.995, // Decay per query
  epsilonMin: 0.05, // Minimum exploration
  maxQTableSize: 10000, // Max state-action pairs
  maxExperiences: 1000, // Max experiences
};

// Global Q-table (persisted across requests)
let qtable: QTable = new Map();
let config: QLearningConfig = { ...DEFAULT_CONFIG };
let queriesProcessed = 0;

// Q-table file path
const QTABLE_PATH = path.join(process.cwd(), "data", "qtable.json");

/**
 * Load Q-table from disk on startup
 */
export async function loadQTable(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(QTABLE_PATH), { recursive: true });
    const data = await fs.readFile(QTABLE_PATH, "utf-8");
    const persisted: PersistedQTable = JSON.parse(data);

    // Convert persisted format to Map
    qtable = new Map();
    for (const [stateKey, actions] of Object.entries(persisted.qtable)) {
      const actionMap = new Map<string, number>();
      for (const [action, qValue] of Object.entries(actions)) {
        actionMap.set(action, qValue);
      }
      qtable.set(stateKey, actionMap);
    }

    config = persisted.hyperparams;
    console.log(`[Q-Learning] Loaded Q-table with ${qtable.size} states`);
  } catch (error) {
    console.log("[Q-Learning] No existing Q-table found, starting fresh");
    qtable = new Map();
  }
}

/**
 * Save Q-table to disk
 */
export async function saveQTable(): Promise<void> {
  try {
    // Convert Map to plain object for JSON serialization
    const plainQTable: Record<string, Record<string, number>> = {};
    for (const [stateKey, actions] of qtable.entries()) {
      plainQTable[stateKey] = {};
      for (const [action, qValue] of actions.entries()) {
        plainQTable[stateKey][action] = qValue;
      }
    }

    const persisted: PersistedQTable = {
      version: 1,
      updatedAt: new Date().toISOString(),
      hyperparams: config,
      qtable: plainQTable,
    };

    await fs.mkdir(path.dirname(QTABLE_PATH), { recursive: true });
    await fs.writeFile(QTABLE_PATH, JSON.stringify(persisted, null, 2));
    console.log(`[Q-Learning] Saved Q-table with ${qtable.size} states`);
  } catch (error) {
    console.error("[Q-Learning] Failed to save Q-table:", error);
  }
}

/**
 * Get Q-value for state-action pair
 */
export function getQValue(stateKey: string, action: string): number {
  if (!qtable.has(stateKey)) {
    return getInitialQValue(action);
  }

  const actionMap = qtable.get(stateKey)!;
  if (!actionMap.has(action)) {
    return getInitialQValue(action);
  }

  return actionMap.get(action)!;
}

/**
 * Set Q-value for state-action pair
 */
export function setQValue(
  stateKey: string,
  action: string,
  value: number
): void {
  if (!qtable.has(stateKey)) {
    qtable.set(stateKey, new Map());
  }

  const actionMap = qtable.get(stateKey)!;
  actionMap.set(action, value);

  // LRU eviction if Q-table is too large
  if (qtable.size > config.maxQTableSize) {
    evictOldestEntry();
  }
}

/**
 * Update Q-value using Bellman equation
 * Q(s,a) = Q(s,a) + α[r + γ·max(Q(s',a')) - Q(s,a)]
 */
export function updateQValue(
  stateKey: string,
  action: string,
  reward: number,
  nextStateKey: string,
  applicableActions: string[]
): void {
  const currentQ = getQValue(stateKey, action);

  // Find max Q-value for next state
  const maxNextQ = Math.max(
    ...applicableActions.map((a) => getQValue(nextStateKey, a))
  );

  // Bellman update
  const newQ = currentQ + config.alpha * (reward + config.gamma * maxNextQ - currentQ);

  setQValue(stateKey, action, newQ);
}

/**
 * Select action using epsilon-greedy strategy
 */
export function selectAction(
  stateKey: string,
  applicableActions: string[]
): string {
  // Exploration: random action
  if (Math.random() < config.epsilon) {
    const randomIndex = Math.floor(Math.random() * applicableActions.length);
    return applicableActions[randomIndex];
  }

  // Exploitation: best Q-value
  let bestAction = applicableActions[0];
  let bestQValue = getQValue(stateKey, bestAction);

  for (const action of applicableActions) {
    const qValue = getQValue(stateKey, action);
    if (qValue > bestQValue) {
      bestQValue = qValue;
      bestAction = action;
    }
  }

  return bestAction;
}

/**
 * Decay epsilon (reduce exploration over time)
 */
export function decayEpsilon(): void {
  queriesProcessed++;
  config.epsilon = Math.max(
    config.epsilonMin,
    config.epsilon * config.epsilonDecay
  );

  console.log(`[Q-Learning] Epsilon decayed to ${config.epsilon.toFixed(3)} (queries: ${queriesProcessed})`);
}

/**
 * Get initial Q-value for new state-action pairs
 */
function getInitialQValue(action: string): number {
  // Slight bias toward generator/LLM policy initially
  if (action === "USE_GENERATOR" || action === "USE_LLM_POLICY") {
    return 0.5;
  }
  return 0.0;
}

/**
 * Evict oldest entry from Q-table (simple LRU)
 */
function evictOldestEntry(): void {
  const firstKey = qtable.keys().next().value;
  if (firstKey) {
    qtable.delete(firstKey);
    console.log("[Q-Learning] Evicted oldest Q-table entry (LRU)");
  }
}

/**
 * Get Q-table statistics
 */
export function getQTableStats(): {
  size: number;
  epsilon: number;
  queriesProcessed: number;
  topStateActions: Array<{ stateKey: string; action: string; qValue: number }>;
} {
  // Get top 10 state-action pairs by Q-value
  const allPairs: Array<{ stateKey: string; action: string; qValue: number }> = [];

  for (const [stateKey, actions] of qtable.entries()) {
    for (const [action, qValue] of actions.entries()) {
      allPairs.push({ stateKey, action, qValue });
    }
  }

  allPairs.sort((a, b) => b.qValue - a.qValue);
  const topStateActions = allPairs.slice(0, 10);

  return {
    size: qtable.size,
    epsilon: config.epsilon,
    queriesProcessed,
    topStateActions,
  };
}

/**
 * Reset Q-table (for testing or debugging)
 */
export function resetQTable(): void {
  qtable = new Map();
  config = { ...DEFAULT_CONFIG };
  queriesProcessed = 0;
  console.log("[Q-Learning] Q-table reset");
}

// Initialize Q-table on module load
loadQTable().catch((error) => {
  console.error("[Q-Learning] Failed to load Q-table:", error);
});
