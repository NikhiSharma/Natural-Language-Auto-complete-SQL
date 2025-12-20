import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { optimizeWithRL } from '@/lib/rl/optimizerGeneric';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate output using OpenAI
async function generateOutput(input: {
  objective: any;
  context: string;
  previousOutput: string | null;
  feedback: any;
}): Promise<string> {
  const { context, previousOutput, feedback } = input;
  
  const systemPrompt = previousOutput && feedback
    ? `You are an AI assistant. Improve the previous output based on this feedback: ${feedback}. Be concise and direct.`
    : `You are an AI assistant. Provide direct, concise responses. Start with "Optimized Output:" followed by the actual result. Keep explanations brief - only 2-3 key points if needed.`;

  const userPrompt = previousOutput 
    ? `Context: ${context}\n\nPrevious output: ${previousOutput}\n\nPlease improve it. Be concise.`
    : context;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content || '';
}

// Evaluate output against objective constraints
function evaluateOutput(output: string, objective: any): { passed: boolean; issues: string[] } {
  const issues: string[] = [];
  const { constraints } = objective;

  // Check mustInclude items
  if (constraints.mustInclude?.length > 0) {
    const missing = constraints.mustInclude.filter((item: string) => 
      !output.toLowerCase().includes(item.toLowerCase())
    );
    if (missing.length > 0) {
      issues.push(`Missing required elements: ${missing.join(', ')}`);
    }
  }

  // Check mustAvoid items
  if (constraints.mustAvoid?.length > 0) {
    const found = constraints.mustAvoid.filter((item: string) => 
      output.toLowerCase().includes(item.toLowerCase())
    );
    if (found.length > 0) {
      issues.push(`Contains forbidden elements: ${found.join(', ')}`);
    }
  }

  // Check tone
  if (constraints.tone) {
    const toneKeywords: { [key: string]: string[] } = {
      professional: ['please', 'thank you', 'consider', 'recommend'],
      casual: ['hey', 'cool', 'awesome', 'great'],
      technical: ['implement', 'configure', 'optimize', 'architecture'],
      friendly: ['happy', 'glad', 'help', 'feel free'],
    };

    const expectedKeywords = toneKeywords[constraints.tone.toLowerCase()] || [];
    const hasExpectedTone = expectedKeywords.some(keyword => 
      output.toLowerCase().includes(keyword)
    );

    if (!hasExpectedTone && expectedKeywords.length > 0) {
      issues.push(`Tone should be more ${constraints.tone}`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

// Analyze output features for state representation
function analyzeOutput(output: string): Record<string, number> {
  const words = output.split(/\s+/).length;
  const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const paragraphs = output.split(/\n\n+/).filter(p => p.trim().length > 0).length;
  const hasStructure = paragraphs > 1 ? 1 : 0;
  
  return {
    length: output.length,
    wordCount: words,
    sentenceCount: sentences,
    paragraphCount: paragraphs,
    hasStructure,
    avgWordLength: output.length / Math.max(words, 1),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { objective, userQuery } = await req.json();

    console.log('\n========== RL OPTIMIZATION WITH Q-LEARNING ==========');
    console.log('User Query:', userQuery);
    console.log('Objective:', JSON.stringify(objective, null, 2));

    // Create wrapper functions for the optimizer
    const generateWrapper = async (input: any) => {
      return generateOutput(input);
    };

    const evaluateWrapper = (output: string, analysis: any, objective: any) => {
      const result = evaluateOutput(output, objective);
      return {
        passed: result.passed,
        feedback: result.issues.length > 0 ? result.issues.join('; ') : null,
        constraintsSatisfied: result.passed,
        issues: result.issues,
      };
    };

    // Run Q-learning optimization
    const result = await optimizeWithRL(
      objective,
      userQuery,
      generateWrapper,
      evaluateWrapper,
      analyzeOutput,
      6, // maxIterations - reduced for speed
    );

    console.log('\n========== Q-LEARNING RESULTS ==========');
    console.log('Total Iterations:', result.iterations);
    console.log('Final Reward:', result.finalReward);
    console.log('Iteration Logs:', result.iterationLogs?.length || 0, 'logs');

    return NextResponse.json({
      optimizedOutput: result.output,
      iterations: result.iterations,
      finalReward: result.finalReward,
      finalQuality: result.finalReward, // For frontend compatibility
      finalLength: result.output?.length || 0,
      converged: result.finalReward >= 70,
      iterationLogs: result.iterationLogs,
    });

  } catch (error: any) {
    console.error('Error in RL optimization:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to optimize with RL' },
      { status: 500 }
    );
  }
}
