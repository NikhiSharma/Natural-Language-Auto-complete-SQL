/**
 * Experience Replay Buffer with Cloudflare KV Storage
 * 
 * This is a KV-compatible version of experience.ts for Cloudflare Workers.
 * Uses KV namespace instead of file system for experience persistence.
 */

import { Experience } from './types';

export class ExperienceBufferKV {
  private experiences: Experience[] = [];
  private maxSize: number;
  private kvNamespace: KVNamespace;
  private kvKey: string;

  constructor(maxSize = 1000, kvNamespace: KVNamespace, kvKey = 'experiences') {
    this.maxSize = maxSize;
    this.kvNamespace = kvNamespace;
    this.kvKey = kvKey;
  }

  /**
   * Load experiences from KV storage
   */
  async loadExperiences(): Promise<void> {
    try {
      const stored = await this.kvNamespace.get(this.kvKey, 'json') as Experience[] | null;
      
      if (stored && Array.isArray(stored)) {
        this.experiences = stored.slice(-this.maxSize); // Keep only most recent
        console.log(`[ExperienceBufferKV] Loaded ${this.experiences.length} experiences from KV`);
      } else {
        console.log('[ExperienceBufferKV] No existing experiences in KV, starting fresh');
        this.experiences = [];
      }
    } catch (error) {
      console.error('[ExperienceBufferKV] Error loading experiences from KV:', error);
      this.experiences = [];
    }
  }

  /**
   * Save experiences to KV storage
   */
  async saveExperiences(): Promise<void> {
    try {
      await this.kvNamespace.put(this.kvKey, JSON.stringify(this.experiences));
      console.log(`[ExperienceBufferKV] Saved ${this.experiences.length} experiences to KV`);
    } catch (error) {
      console.error('[ExperienceBufferKV] Error saving experiences to KV:', error);
    }
  }

  /**
   * Add a new experience to the buffer
   */
  addExperience(experience: Experience): void {
    this.experiences.push(experience);
    
    // Keep only the most recent experiences (FIFO)
    if (this.experiences.length > this.maxSize) {
      this.experiences = this.experiences.slice(-this.maxSize);
    }
  }

  /**
   * Sample random batch of experiences for replay
   */
  sampleBatch(batchSize: number): Experience[] {
    if (this.experiences.length === 0) {
      return [];
    }

    const batch: Experience[] = [];
    const maxSamples = Math.min(batchSize, this.experiences.length);

    // Random sampling without replacement
    const indices = new Set<number>();
    while (indices.size < maxSamples) {
      indices.add(Math.floor(Math.random() * this.experiences.length));
    }

    indices.forEach(i => batch.push(this.experiences[i]));
    return batch;
  }

  /**
   * Get all experiences
   */
  getAllExperiences(): Experience[] {
    return this.experiences;
  }

  /**
   * Get buffer size
   */
  getSize(): number {
    return this.experiences.length;
  }

  /**
   * Clear all experiences
   */
  clear(): void {
    this.experiences = [];
  }

  /**
   * Get experiences for a specific use case
   */
  getExperiencesForUseCase(useCase: string): Experience[] {
    return this.experiences.filter(exp => 
      exp.state.includes(`useCase:${useCase}`)
    );
  }

  /**
   * Get high-reward experiences (for learning from successes)
   */
  getHighRewardExperiences(minReward: number): Experience[] {
    return this.experiences.filter(exp => exp.reward >= minReward);
  }

  /**
   * Get recent experiences (last N)
   */
  getRecentExperiences(count: number): Experience[] {
    return this.experiences.slice(-count);
  }
}
