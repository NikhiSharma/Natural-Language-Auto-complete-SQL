"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/backend/index.ts
var backend_exports = {};
__export(backend_exports, {
  GenericAction: () => GenericAction,
  optimizeWithRL: () => optimizeWithRL
});
module.exports = __toCommonJS(backend_exports);

// src/backend/generic/actions.ts
var GenericAction = /* @__PURE__ */ ((GenericAction2) => {
  GenericAction2["USE_GENERATOR"] = "USE_GENERATOR";
  GenericAction2["PERTURB_OUTPUT"] = "PERTURB_OUTPUT";
  GenericAction2["SIMPLIFY"] = "SIMPLIFY";
  GenericAction2["EXPAND"] = "EXPAND";
  GenericAction2["REFINE"] = "REFINE";
  GenericAction2["RESET"] = "RESET";
  return GenericAction2;
})(GenericAction || {});
function getApplicableActions(output, objective, iteration = 0) {
  const actions = [];
  actions.push("USE_GENERATOR" /* USE_GENERATOR */);
  if (output && !isOutputEmpty(output)) {
    actions.push("PERTURB_OUTPUT" /* PERTURB_OUTPUT */);
    actions.push("REFINE" /* REFINE */);
    if (getOutputComplexity(output) > 0.5) {
      actions.push("SIMPLIFY" /* SIMPLIFY */);
    }
    if (getOutputComplexity(output) < 0.7) {
      actions.push("EXPAND" /* EXPAND */);
    }
  }
  if (iteration > 3) {
    actions.push("RESET" /* RESET */);
  }
  return actions;
}
function applyAction(output, action, objective) {
  switch (action.type) {
    case "USE_GENERATOR" /* USE_GENERATOR */:
    case "RESET" /* RESET */:
      return null;
    case "PERTURB_OUTPUT" /* PERTURB_OUTPUT */:
      return perturbOutput(output, action.parameters);
    case "SIMPLIFY" /* SIMPLIFY */:
      return simplifyOutput(output, action.parameters);
    case "EXPAND" /* EXPAND */:
      return expandOutput(output, action.parameters);
    case "REFINE" /* REFINE */:
      return null;
    default:
      return output;
  }
}
function perturbOutput(output, parameters) {
  if (typeof output === "string") {
    const words = output.split(" ");
    if (words.length > 2) {
      const i = Math.floor(Math.random() * words.length);
      const j = Math.floor(Math.random() * words.length);
      [words[i], words[j]] = [words[j], words[i]];
      return words.join(" ");
    }
  }
  if (Array.isArray(output)) {
    const result = [...output];
    if (result.length > 2) {
      const i = Math.floor(Math.random() * result.length);
      const j = Math.floor(Math.random() * result.length);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  return output;
}
function simplifyOutput(output, parameters) {
  if (typeof output === "string") {
    const maxLength = parameters?.maxLength || output.length * 0.8;
    return output.substring(0, Math.floor(maxLength));
  }
  if (Array.isArray(output)) {
    const maxSize = parameters?.maxSize || Math.floor(output.length * 0.8);
    return output.slice(0, maxSize);
  }
  if (typeof output === "object" && output !== null) {
    const keys = Object.keys(output);
    const keepCount = Math.floor(keys.length * 0.8);
    const result = {};
    for (let i = 0; i < keepCount; i++) {
      result[keys[i]] = output[keys[i]];
    }
    return result;
  }
  return output;
}
function expandOutput(output, parameters) {
  return null;
}
function getOutputComplexity(output) {
  if (typeof output === "string") {
    const length = output.length;
    const words = output.split(" ").length;
    const avgWordLength = words > 0 ? length / words : 0;
    const lengthScore = Math.min(length / 1e3, 1);
    const wordScore = Math.min(avgWordLength / 10, 1);
    return (lengthScore + wordScore) / 2;
  }
  if (Array.isArray(output)) {
    const size = output.length;
    const hasNested = output.some(
      (item) => typeof item === "object" || Array.isArray(item)
    );
    const sizeScore = Math.min(size / 100, 1);
    const nestScore = hasNested ? 0.5 : 0;
    return (sizeScore + nestScore) / 1.5;
  }
  if (typeof output === "object" && output !== null) {
    const keys = Object.keys(output);
    const keyCount = keys.length;
    const hasNested = keys.some(
      (key) => typeof output[key] === "object" || Array.isArray(output[key])
    );
    const keyScore = Math.min(keyCount / 50, 1);
    const nestScore = hasNested ? 0.5 : 0;
    return (keyScore + nestScore) / 1.5;
  }
  return 0.5;
}
function isOutputEmpty(output) {
  if (output === null || output === void 0) {
    return true;
  }
  if (typeof output === "string") {
    return output.trim().length === 0;
  }
  if (Array.isArray(output)) {
    return output.length === 0;
  }
  if (typeof output === "object") {
    return Object.keys(output).length === 0;
  }
  return false;
}

// src/backend/generic/state.ts
var import_crypto = __toESM(require("crypto"));
function extractGenericState(output, objective, analysis, iteration = 0) {
  const objectiveHash = hashObject(objective);
  const outputHash = hashObject(output);
  const features = {
    // Output-based features
    outputType: typeof output,
    outputLength: getOutputLength(output),
    isEmpty: isOutputEmpty2(output),
    // Analysis-based features (if available)
    ...analysis || {},
    // Objective-based features
    hasConstraints: objective.constraints !== void 0,
    constraintCount: objective.constraints ? Object.keys(objective.constraints).length : 0
  };
  return {
    objectiveHash,
    outputHash,
    features,
    metadata: {
      iteration,
      timestamp: Date.now()
    }
  };
}
function getStateKey(state) {
  const keyFeatures = {
    objective: state.objectiveHash,
    output: state.outputHash,
    // Include important features that distinguish states
    outputLength: state.features.outputLength,
    isEmpty: state.features.isEmpty
  };
  return hashObject(keyFeatures);
}
function hashObject(obj) {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  return import_crypto.default.createHash("md5").update(str).digest("hex").substring(0, 16);
}
function getOutputLength(output) {
  if (typeof output === "string") {
    return output.length;
  }
  if (Array.isArray(output)) {
    return output.length;
  }
  if (typeof output === "object" && output !== null) {
    return Object.keys(output).length;
  }
  return 0;
}
function isOutputEmpty2(output) {
  if (output === null || output === void 0) {
    return true;
  }
  if (typeof output === "string") {
    return output.trim().length === 0;
  }
  if (Array.isArray(output)) {
    return output.length === 0;
  }
  if (typeof output === "object") {
    return Object.keys(output).length === 0;
  }
  return false;
}

// src/backend/generic/reward.ts
function calculateGenericReward(output, objective, evaluation, metrics) {
  let constraintScore = 0;
  let qualityScore = 0;
  const details = [];
  if (evaluation.passed) {
    constraintScore = 60;
    details.push("\u2713 All constraints satisfied (+60)");
  } else {
    constraintScore = 0;
    details.push(`\u2717 Constraints failed: ${evaluation.feedback?.code || "UNKNOWN"} (+0)`);
  }
  if (metrics.hasErrors) {
    qualityScore -= 30;
    details.push("\u2717 Execution errors (-30)");
  } else {
    qualityScore += 10;
    details.push("\u2713 No errors (+10)");
  }
  if (metrics.executionTime !== void 0) {
    if (metrics.executionTime < 50) {
      qualityScore += 15;
      details.push(`\u2713 Fast execution: ${metrics.executionTime}ms (+15)`);
    } else if (metrics.executionTime < 100) {
      qualityScore += 10;
      details.push(`\u2713 Good execution: ${metrics.executionTime}ms (+10)`);
    } else if (metrics.executionTime > 1e3) {
      qualityScore -= 10;
      details.push(`\u2717 Slow execution: ${metrics.executionTime}ms (-10)`);
    }
  }
  if (metrics.outputSize !== void 0 && metrics.expectedSize !== void 0) {
    const sizeDiff = Math.abs(metrics.outputSize - metrics.expectedSize);
    const sizeRatio = sizeDiff / metrics.expectedSize;
    if (sizeRatio < 0.1) {
      qualityScore += 10;
      details.push("\u2713 Optimal size (+10)");
    } else if (sizeRatio > 0.5) {
      qualityScore -= 5;
      details.push("\u2717 Size mismatch (-5)");
    }
  }
  if (metrics.customMetrics) {
    for (const [metric, value] of Object.entries(metrics.customMetrics)) {
      qualityScore += value;
      details.push(`Custom metric ${metric}: ${value > 0 ? "+" : ""}${value}`);
    }
  }
  const total = constraintScore + qualityScore;
  return {
    total,
    constraintScore,
    qualityScore,
    details
  };
}
function validateGenericSemantics(output, objective, analysis) {
  const issues = [];
  if (!output || typeof output === "string" && output.trim().length === 0) {
    issues.push("Output is empty or null");
  }
  if (objective.expectedType) {
    const actualType = typeof output;
    if (actualType !== objective.expectedType) {
      issues.push(`Expected type ${objective.expectedType}, got ${actualType}`);
    }
  }
  if (objective.minQuality && analysis.quality !== void 0) {
    if (analysis.quality < objective.minQuality) {
      issues.push(`Quality ${analysis.quality} below minimum ${objective.minQuality}`);
    }
  }
  return {
    semanticsMatch: issues.length === 0,
    issues
  };
}

// src/backend/qlearning.ts
var import_promises = __toESM(require("fs/promises"));
var import_path = __toESM(require("path"));
var DEFAULT_CONFIG = {
  alpha: 0.1,
  // Learning rate
  gamma: 0.9,
  // Discount factor
  epsilon: 0.2,
  // Exploration rate
  epsilonDecay: 0.995,
  // Decay per query
  epsilonMin: 0.05,
  // Minimum exploration
  maxQTableSize: 1e4,
  // Max state-action pairs
  maxExperiences: 1e3
  // Max experiences
};
var qtable = /* @__PURE__ */ new Map();
var config = { ...DEFAULT_CONFIG };
var queriesProcessed = 0;
var QTABLE_PATH = import_path.default.join(process.cwd(), "data", "qtable.json");
async function loadQTable() {
  try {
    await import_promises.default.mkdir(import_path.default.dirname(QTABLE_PATH), { recursive: true });
    const data = await import_promises.default.readFile(QTABLE_PATH, "utf-8");
    const persisted = JSON.parse(data);
    qtable = /* @__PURE__ */ new Map();
    for (const [stateKey, actions] of Object.entries(persisted.qtable)) {
      const actionMap = /* @__PURE__ */ new Map();
      for (const [action, qValue] of Object.entries(actions)) {
        actionMap.set(action, qValue);
      }
      qtable.set(stateKey, actionMap);
    }
    config = persisted.hyperparams;
    console.log(`[Q-Learning] Loaded Q-table with ${qtable.size} states`);
  } catch (error) {
    console.log("[Q-Learning] No existing Q-table found, starting fresh");
    qtable = /* @__PURE__ */ new Map();
  }
}
async function saveQTable() {
  try {
    const plainQTable = {};
    for (const [stateKey, actions] of qtable.entries()) {
      plainQTable[stateKey] = {};
      for (const [action, qValue] of actions.entries()) {
        plainQTable[stateKey][action] = qValue;
      }
    }
    const persisted = {
      version: 1,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      hyperparams: config,
      qtable: plainQTable
    };
    await import_promises.default.mkdir(import_path.default.dirname(QTABLE_PATH), { recursive: true });
    await import_promises.default.writeFile(QTABLE_PATH, JSON.stringify(persisted, null, 2));
    console.log(`[Q-Learning] Saved Q-table with ${qtable.size} states`);
  } catch (error) {
    console.error("[Q-Learning] Failed to save Q-table:", error);
  }
}
function getQValue(stateKey, action) {
  if (!qtable.has(stateKey)) {
    return getInitialQValue(action);
  }
  const actionMap = qtable.get(stateKey);
  if (!actionMap.has(action)) {
    return getInitialQValue(action);
  }
  return actionMap.get(action);
}
function setQValue(stateKey, action, value) {
  if (!qtable.has(stateKey)) {
    qtable.set(stateKey, /* @__PURE__ */ new Map());
  }
  const actionMap = qtable.get(stateKey);
  actionMap.set(action, value);
  if (qtable.size > config.maxQTableSize) {
    evictOldestEntry();
  }
}
function updateQValue(stateKey, action, reward, nextStateKey, applicableActions) {
  const currentQ = getQValue(stateKey, action);
  const maxNextQ = Math.max(
    ...applicableActions.map((a) => getQValue(nextStateKey, a))
  );
  const newQ = currentQ + config.alpha * (reward + config.gamma * maxNextQ - currentQ);
  setQValue(stateKey, action, newQ);
}
function selectAction(stateKey, applicableActions) {
  if (Math.random() < config.epsilon) {
    const randomIndex = Math.floor(Math.random() * applicableActions.length);
    return applicableActions[randomIndex];
  }
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
function decayEpsilon() {
  queriesProcessed++;
  config.epsilon = Math.max(
    config.epsilonMin,
    config.epsilon * config.epsilonDecay
  );
  console.log(`[Q-Learning] Epsilon decayed to ${config.epsilon.toFixed(3)} (queries: ${queriesProcessed})`);
}
function getInitialQValue(action) {
  if (action === "USE_GENERATOR" || action === "USE_LLM_POLICY") {
    return 0.5;
  }
  return 0;
}
function evictOldestEntry() {
  const firstKey = qtable.keys().next().value;
  if (firstKey) {
    qtable.delete(firstKey);
    console.log("[Q-Learning] Evicted oldest Q-table entry (LRU)");
  }
}
loadQTable().catch((error) => {
  console.error("[Q-Learning] Failed to load Q-table:", error);
});

// src/backend/experience.ts
var import_promises2 = __toESM(require("fs/promises"));
var import_path2 = __toESM(require("path"));
var import_crypto2 = __toESM(require("crypto"));
var experiences = [];
var EXPERIENCES_PATH = import_path2.default.join(process.cwd(), "data", "experiences.json");
var MAX_EXPERIENCES = 1e3;
async function loadExperiences() {
  try {
    await import_promises2.default.mkdir(import_path2.default.dirname(EXPERIENCES_PATH), { recursive: true });
    const data = await import_promises2.default.readFile(EXPERIENCES_PATH, "utf-8");
    experiences = JSON.parse(data);
    console.log(`[Experience] Loaded ${experiences.length} experiences`);
  } catch (error) {
    console.log("[Experience] No existing experiences found, starting fresh");
    experiences = [];
  }
}
async function saveExperiences() {
  try {
    await import_promises2.default.mkdir(import_path2.default.dirname(EXPERIENCES_PATH), { recursive: true });
    await import_promises2.default.writeFile(
      EXPERIENCES_PATH,
      JSON.stringify(experiences, null, 2)
    );
    console.log(`[Experience] Saved ${experiences.length} experiences`);
  } catch (error) {
    console.error("[Experience] Failed to save experiences:", error);
  }
}
function addExperience(experience) {
  const exp = {
    ...experience,
    id: generateExperienceId()
  };
  experiences.push(exp);
  if (experiences.length > MAX_EXPERIENCES) {
    experiences.shift();
  }
  return exp;
}
function generateExperienceId() {
  return import_crypto2.default.randomBytes(8).toString("hex");
}
loadExperiences().catch((error) => {
  console.error("[Experience] Failed to load experiences:", error);
});

// src/backend/optimizerGeneric.ts
async function optimizeWithRL(objective, context, generateOutput, evaluateOutput, analyzeOutput, maxIterations = 10, customConfig) {
  console.log("\n========== GENERIC Q-LEARNING OPTIMIZER ==========");
  console.log(`Optimizing for objective: ${JSON.stringify(objective).substring(0, 100)}...`);
  let currentOutput = null;
  let previousFeedback = null;
  let finalReward = 0;
  const iterationLogs = [];
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    console.log(`
--- Iteration ${iteration}/${maxIterations} ---`);
    if (iteration === 1 || currentOutput === null) {
      console.log("[RL] Generating initial output...");
      currentOutput = await generateOutput({
        objective,
        context,
        previousOutput: null,
        feedback: null
      });
      console.log(`[RL] Initial output generated (type: ${typeof currentOutput})`);
    }
    const analysis = analyzeOutput(currentOutput);
    const currentState = customConfig?.customStateExtractor ? customConfig.customStateExtractor(currentOutput, objective, analysis, iteration) : extractGenericState(currentOutput, objective, analysis, iteration);
    const currentStateKey = getStateKey(currentState);
    console.log(`[RL] State: ${currentStateKey.substring(0, 50)}...`);
    console.log(`[RL] Features:`, Object.keys(currentState.features).slice(0, 5));
    const applicableActions = customConfig?.customActionSelector ? customConfig.customActionSelector(currentOutput, objective, iteration) : getApplicableActions(currentOutput, objective, iteration);
    console.log(`[RL] Applicable actions: ${applicableActions.join(", ")}`);
    const selectedAction = selectAction(currentStateKey, applicableActions);
    console.log(`[RL] Selected action: ${selectedAction}`);
    let nextOutput;
    if (selectedAction === "USE_GENERATOR" /* USE_GENERATOR */ || selectedAction === "RESET" /* RESET */) {
      console.log("[RL] Using generator to create new output...");
      nextOutput = await generateOutput({
        objective,
        context,
        previousOutput: currentOutput,
        feedback: previousFeedback
      });
      console.log(`[RL] New output generated (type: ${typeof nextOutput})`);
    } else {
      console.log(`[RL] Applying transformation: ${selectedAction}...`);
      const transformed = applyAction(
        currentOutput,
        { type: selectedAction },
        objective
      );
      if (transformed === null) {
        console.log("[RL] Transformation requires generator, using it...");
        nextOutput = await generateOutput({
          objective,
          context,
          previousOutput: currentOutput,
          feedback: previousFeedback
        });
      } else {
        nextOutput = transformed;
        console.log("[RL] Transformation applied");
      }
    }
    const nextAnalysis = analyzeOutput(nextOutput);
    const evaluationResult = evaluateOutput(nextOutput, nextAnalysis, objective);
    console.log(`[RL] Evaluation: ${evaluationResult.passed ? "\u2713 PASS" : "\u2717 FAIL"}`);
    if (!evaluationResult.passed && evaluationResult.feedback) {
      console.log(`[RL] Feedback: ${evaluationResult.feedback.message}`);
    }
    const semanticValidation = validateGenericSemantics(nextOutput, objective, nextAnalysis);
    console.log(
      `[RL] Semantic Match: ${semanticValidation.semanticsMatch ? "\u2705 YES" : "\u274C NO"}`
    );
    if (!semanticValidation.semanticsMatch) {
      console.log(`[RL] Semantic Issues:`, semanticValidation.issues);
    }
    const executionMetrics = {
      executionTime: nextAnalysis.executionTime,
      outputSize: nextAnalysis.size || nextAnalysis.length,
      expectedSize: objective.expectedSize,
      hasErrors: !evaluationResult.passed,
      customMetrics: nextAnalysis.customMetrics
    };
    let reward = customConfig?.customRewardFn ? customConfig.customRewardFn(nextOutput, objective, evaluationResult, executionMetrics) : calculateGenericReward(nextOutput, objective, evaluationResult, executionMetrics);
    if (!semanticValidation.semanticsMatch) {
      const semanticPenalty = semanticValidation.issues.length * -15;
      console.log(`[RL] Applying semantic penalty: ${semanticPenalty}`);
      reward = {
        ...reward,
        qualityScore: reward.qualityScore + semanticPenalty,
        total: reward.total + semanticPenalty
      };
    }
    console.log(
      `[RL] Reward: ${reward.total} (constraint: ${reward.constraintScore}, quality: ${reward.qualityScore})`
    );
    finalReward = reward.total;
    const nextState = customConfig?.customStateExtractor ? customConfig.customStateExtractor(nextOutput, objective, nextAnalysis, iteration) : extractGenericState(nextOutput, objective, nextAnalysis, iteration);
    const nextStateKey = getStateKey(nextState);
    updateQValue(
      currentStateKey,
      selectedAction,
      reward.total,
      nextStateKey,
      applicableActions
    );
    const experience = addExperience({
      stateKey: currentStateKey,
      action: selectedAction,
      reward: reward.total,
      nextStateKey,
      terminal: evaluationResult.passed,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      objectiveHash: currentState.objectiveHash
    });
    console.log(`[RL] Stored experience: ${experience.id}`);
    iterationLogs.push({
      iteration,
      output: nextOutput,
      action: selectedAction,
      state: currentStateKey.substring(0, 80),
      evaluation: evaluationResult,
      semanticMatch: semanticValidation.semanticsMatch,
      semanticIssues: semanticValidation.issues || [],
      reward,
      converged: evaluationResult.passed && semanticValidation.semanticsMatch && reward.total >= 100
    });
    if (evaluationResult.passed && semanticValidation.semanticsMatch && reward.total >= 100) {
      console.log("\n\u2705 CONVERGED - Output meets all constraints AND semantic intent!");
      console.log(`Final output (type: ${typeof nextOutput})`);
      if (customConfig?.persistLearning) {
        saveQTable().catch((err) => console.error("Failed to save Q-table:", err));
        saveExperiences().catch(
          (err) => console.error("Failed to save experiences:", err)
        );
      }
      decayEpsilon();
      return {
        output: nextOutput,
        iterations: iteration,
        finalReward: reward.total,
        iterationLogs
      };
    }
    if (evaluationResult.passed && !semanticValidation.semanticsMatch && iteration === maxIterations) {
      console.log("\n\u26A0\uFE0F  PARTIAL CONVERGENCE - Constraints pass but semantic issues remain");
      console.log("Semantic issues:", semanticValidation.issues);
    }
    currentOutput = nextOutput;
    previousFeedback = evaluationResult.feedback || null;
  }
  console.log("\n\u274C Max iterations reached without full convergence");
  if (customConfig?.persistLearning) {
    saveQTable().catch((err) => console.error("Failed to save Q-table:", err));
    saveExperiences().catch((err) => console.error("Failed to save experiences:", err));
  }
  decayEpsilon();
  return {
    output: currentOutput,
    iterations: maxIterations,
    finalReward,
    iterationLogs
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GenericAction,
  optimizeWithRL
});
//# sourceMappingURL=index.js.map