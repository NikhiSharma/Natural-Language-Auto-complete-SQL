import { Experience } from "./types";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Experience replay buffer
let experiences: Experience[] = [];

// Experience buffer file path
const EXPERIENCES_PATH = path.join(process.cwd(), "data", "experiences.json");

const MAX_EXPERIENCES = 1000;

/**
 * Load experiences from disk on startup
 */
export async function loadExperiences(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(EXPERIENCES_PATH), { recursive: true });
    const data = await fs.readFile(EXPERIENCES_PATH, "utf-8");
    experiences = JSON.parse(data);
    console.log(`[Experience] Loaded ${experiences.length} experiences`);
  } catch (error) {
    console.log("[Experience] No existing experiences found, starting fresh");
    experiences = [];
  }
}

/**
 * Save experiences to disk
 */
export async function saveExperiences(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(EXPERIENCES_PATH), { recursive: true});
    await fs.writeFile(
      EXPERIENCES_PATH,
      JSON.stringify(experiences, null, 2)
    );
    console.log(`[Experience] Saved ${experiences.length} experiences`);
  } catch (error) {
    console.error("[Experience] Failed to save experiences:", error);
  }
}

/**
 * Add experience to replay buffer
 */
export function addExperience(experience: Omit<Experience, "id">): Experience {
  const exp: Experience = {
    ...experience,
    id: generateExperienceId(),
  };

  experiences.push(exp);

  // Circular buffer: remove oldest if exceeds max
  if (experiences.length > MAX_EXPERIENCES) {
    experiences.shift();
  }

  return exp;
}

/**
 * Get experience by ID
 */
export function getExperienceById(id: string): Experience | undefined {
  return experiences.find((exp) => exp.id === id);
}

/**
 * Get all experiences
 */
export function getAllExperiences(): Experience[] {
  return [...experiences];
}

/**
 * Get recent experiences (last N)
 */
export function getRecentExperiences(count: number): Experience[] {
  return experiences.slice(-count);
}

/**
 * Sample random batch of experiences for offline learning
 */
export function sampleExperiences(batchSize: number): Experience[] {
  if (experiences.length <= batchSize) {
    return [...experiences];
  }

  const sampled: Experience[] = [];
  const indices = new Set<number>();

  while (sampled.length < batchSize) {
    const randomIndex = Math.floor(Math.random() * experiences.length);
    if (!indices.has(randomIndex)) {
      indices.add(randomIndex);
      sampled.push(experiences[randomIndex]);
    }
  }

  return sampled;
}

/**
 * Get experiences by objective hash
 */
export function getExperiencesByObjective(
  objectiveHash: string
): Experience[] {
  return experiences.filter((exp) => exp.objectiveHash === objectiveHash);
}

/**
 * Calculate average reward for recent experiences
 */
export function getAverageReward(count: number = 50): number {
  if (experiences.length === 0) return 0;

  const recent = getRecentExperiences(count);
  const totalReward = recent.reduce((sum, exp) => sum + exp.reward, 0);

  return totalReward / recent.length;
}

/**
 * Get experience statistics
 */
export function getExperienceStats(): {
  totalExperiences: number;
  averageReward: number;
  successRate: number;
  recentRewards: number[];
} {
  const recent = getRecentExperiences(20);

  return {
    totalExperiences: experiences.length,
    averageReward: getAverageReward(50),
    successRate:
      experiences.length > 0
        ? experiences.filter((exp) => exp.terminal).length / experiences.length
        : 0,
    recentRewards: recent.map((exp) => exp.reward),
  };
}

/**
 * Clear all experiences (for testing/debugging)
 */
export function clearExperiences(): void {
  experiences = [];
  console.log("[Experience] Cleared all experiences");
}

/**
 * Generate unique experience ID
 */
function generateExperienceId(): string {
  return crypto.randomBytes(8).toString("hex");
}

// Initialize experiences on module load
loadExperiences().catch((error) => {
  console.error("[Experience] Failed to load experiences:", error);
});
