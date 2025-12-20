/**
 * Generic RL Types for @nikhilayeturi23/rltool
 *
 * These types are domain-agnostic and work for any optimization task.
 */

/**
 * Reward breakdown (autonomous learning)
 */
export type Reward = {
  constraintScore: number;    // 0-100: How well constraints are met
  qualityScore: number;        // -20 to +30: Query quality (simplicity, speed, etc.)
  userFeedback?: number;       // Deprecated: Not used in autonomous mode
  total: number;               // Total reward for Q-learning
};

/**
 * Experience tuple for replay buffer
 */
export type Experience = {
  id: string;
  stateKey: string;
  action: string;  // Generic action (can be GenericAction or any string)
  reward: number;
  nextStateKey: string;
  terminal: boolean;
  timestamp: string;
  objectiveHash: string;
};

/**
 * Q-Table: Maps state-action pairs to Q-values
 */
export type QTable = Map<string, Map<string, number>>;

/**
 * Q-Learning hyperparameters
 */
export type QLearningConfig = {
  alpha: number; // Learning rate
  gamma: number; // Discount factor
  epsilon: number; // Exploration rate
  epsilonDecay: number; // Decay rate for epsilon
  epsilonMin: number; // Minimum epsilon
  maxQTableSize: number; // Max entries before LRU eviction
  maxExperiences: number; // Max experiences to store
};

/**
 * Persisted Q-Table format
 */
export type PersistedQTable = {
  version: number;
  updatedAt: string;
  hyperparams: QLearningConfig;
  qtable: Record<string, Record<string, number>>;
};
