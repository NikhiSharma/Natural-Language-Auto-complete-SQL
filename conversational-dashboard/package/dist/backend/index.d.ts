/**
 * Generic Action System
 *
 * Domain-agnostic action selection and application for RL optimization.
 * Works with any type of output and objective.
 */
/**
 * Generic action types
 *
 * These are domain-agnostic actions that can be applied to any optimization task.
 */
declare enum GenericAction {
    /** Use the generator function (e.g., LLM) to create a new output */
    USE_GENERATOR = "USE_GENERATOR",
    /** Apply a small perturbation to the current output */
    PERTURB_OUTPUT = "PERTURB_OUTPUT",
    /** Simplify the output (reduce complexity) */
    SIMPLIFY = "SIMPLIFY",
    /** Expand the output (add more detail) */
    EXPAND = "EXPAND",
    /** Refine the output (improve quality without changing structure) */
    REFINE = "REFINE",
    /** Reset and start over with generator */
    RESET = "RESET"
}

/**
 * Generic State Extraction
 *
 * Domain-agnostic state representation for RL optimization.
 * Works with any type of output and objective.
 */
interface GenericState {
    /** Hash of the objective (for grouping similar problems) */
    objectiveHash: string;
    /** Hash of the current output */
    outputHash: string;
    /** Features extracted from the output */
    features: Record<string, any>;
    /** Metadata about the state */
    metadata: {
        iteration: number;
        timestamp: number;
    };
}

/**
 * Generic Reward Calculation
 *
 * Domain-agnostic reward calculation for RL optimization.
 * Works with any type of output, objective, and evaluation result.
 */
interface GenericEvaluationResult {
    passed: boolean;
    feedback?: {
        code: string;
        message: string;
        fix: string;
    };
}
interface GenericExecutionMetrics {
    executionTime?: number;
    outputSize?: number;
    expectedSize?: number;
    hasErrors: boolean;
    customMetrics?: Record<string, number>;
}
interface RewardComponents {
    total: number;
    constraintScore: number;
    qualityScore: number;
    details: string[];
}

/**
 * Fully Generic RL Optimizer using Q-Learning
 *
 * This optimizer is completely domain-agnostic and can optimize ANY type of output.
 * It uses only generic helper functions - NO SQL-specific code.
 */

/**
 * Generic types for any domain
 */
type GenericFeedback = {
    code: string;
    message: string;
    fix: string;
};
type GenericContext = any;
type GenericOutput = any;
type GenericObjective = any;
interface IterationLog {
    iteration: number;
    output: GenericOutput;
    action: string;
    state: string;
    evaluation: GenericEvaluationResult;
    semanticMatch: boolean;
    semanticIssues: string[];
    reward: RewardComponents;
    converged: boolean;
}
interface OptimizationResult {
    output: GenericOutput;
    iterations: number;
    finalReward: number;
    iterationLogs: IterationLog[];
}
/**
 * Fully Generic RL Optimizer
 *
 * This function can optimize ANYTHING using Q-learning.
 * It's completely independent from SQL or any specific domain.
 *
 * @param objective - The optimization objective (any structure)
 * @param context - Domain-specific context (e.g., schema, rules, constraints)
 * @param generateOutput - Function to generate/improve output
 * @param evaluateOutput - Function to evaluate if output meets constraints
 * @param analyzeOutput - Function to analyze output structure
 * @param maxIterations - Maximum number of iterations
 * @param customConfig - Optional custom configuration
 * @returns Optimization result
 */
declare function optimizeWithRL(objective: GenericObjective, context: GenericContext, generateOutput: (input: {
    objective: GenericObjective;
    context: GenericContext;
    previousOutput: GenericOutput | null;
    feedback: GenericFeedback | null;
}) => Promise<GenericOutput>, evaluateOutput: (output: GenericOutput, analysis: any, objective: GenericObjective) => GenericEvaluationResult, analyzeOutput: (output: GenericOutput) => any, maxIterations?: number, customConfig?: {
    customRewardFn?: (output: any, objective: any, evaluation: GenericEvaluationResult, metrics: GenericExecutionMetrics) => RewardComponents;
    customStateExtractor?: (output: any, objective: any, analysis?: any, iteration?: number) => GenericState;
    customActionSelector?: (output: any, objective: any, iteration: number) => GenericAction[];
    persistLearning?: boolean;
}): Promise<OptimizationResult>;

/**
 * Generic RL Types for @nikhilayeturi23/rltool
 *
 * These types are domain-agnostic and work for any optimization task.
 */
/**
 * Reward breakdown (autonomous learning)
 */
type Reward = {
    constraintScore: number;
    qualityScore: number;
    userFeedback?: number;
    total: number;
};
/**
 * Experience tuple for replay buffer
 */
type Experience = {
    id: string;
    stateKey: string;
    action: string;
    reward: number;
    nextStateKey: string;
    terminal: boolean;
    timestamp: string;
    objectiveHash: string;
};
/**
 * Q-Table: Maps state-action pairs to Q-values
 */
type QTable = Map<string, Map<string, number>>;
/**
 * Q-Learning hyperparameters
 */
type QLearningConfig = {
    alpha: number;
    gamma: number;
    epsilon: number;
    epsilonDecay: number;
    epsilonMin: number;
    maxQTableSize: number;
    maxExperiences: number;
};

export { type Experience, GenericAction, type GenericContext, type GenericEvaluationResult, type GenericExecutionMetrics, type GenericFeedback, type GenericObjective, type GenericOutput, type GenericState, type IterationLog, type OptimizationResult, type QLearningConfig, type QTable, type Reward, type RewardComponents, optimizeWithRL };
