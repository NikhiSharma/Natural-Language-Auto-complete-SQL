/**
 * Generic RL Core - Domain-Agnostic Reinforcement Learning
 *
 * This module provides a generic RL optimizer that can be applied to any domain.
 * It is completely decoupled from SQL or any specific use case.
 *
 * This is a re-export of the generic optimizer functionality.
 */

export {
  optimizeWithRL,
  GenericFeedback,
  GenericContext,
  GenericOutput,
  GenericObjective,
  OptimizationResult
} from "./optimizerGeneric";
