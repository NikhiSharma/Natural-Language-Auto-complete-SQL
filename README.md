# AI Assistant with Q-Learning Reinforcement Learning

A domain-agnostic AI assistant that uses Q-learning reinforcement learning to optimize responses in real-time. Works for SQL queries, content creation, code optimization, data analysis, and more.

##  What It Does

This system analyzes user queries, generates structured objectives, and uses Q-learning to iteratively refine outputs until they meet specified constraints and quality standards.

**Example Flow:**
1. User asks: "Optimize this SQL query" or "Make this email more professional"
2. System generates objective function with constraints (mustInclude, mustAvoid, tone, style)
3. Quick basic response appears in chat
4. Q-learning optimizer runs 3-6 iterations to produce refined output
5. Optimized result displays in dedicated section

##  How Q-Learning Works Here

### State-Action-Reward Loop

1. **State Extraction**: Analyzes output features (length, structure, complexity, iteration count)
2. **Action Selection**: Epsilon-greedy strategy chooses from:
   - `USE_GENERATOR`: Create new output with OpenAI
   - `REFINE`: Improve existing output
   - `SIMPLIFY`: Make more concise
   - `EXPAND`: Add more detail
   - `PERTURB_OUTPUT`: Make small random changes
   - `RESET`: Start fresh

3. **Reward Calculation**:
   - **Constraint Score (60 pts)**: Check mustInclude/mustAvoid requirements
   - **Quality Score (40 pts)**: Evaluate clarity, completeness, accuracy
   - **Total Reward**: 100 = perfect, 70 = good enough (early stopping threshold)

4. **Q-Value Update**: Bellman equation with learning rate 0.1, discount factor 0.95
   ```
   Q(s,a) ← Q(s,a) + α[r + γ·max Q(s',a') - Q(s,a)]
   ```

5. **Experience Replay**: Store state-action-reward transitions for future learning

### Learning Over Time

- **Q-table** (`data/qtable.json`): Persists learned state-action values across sessions
- **Epsilon decay**: Starts at 0.2 (20% exploration), decreases with usage
- **Experience buffer** (`data/experiences.json`): Saves learning history
- **Gets smarter**: Fewer iterations needed as Q-table matures

##  Architecture

### Core Files

**Frontend (User Interface)**
- `app/page.tsx` - Main UI with chat, objective editing, RL button
- `app/api/objective/generate/route.ts` - Generates objectives from queries
- `app/api/generate/route.ts` - Basic response endpoint
- `app/api/rl/optimize/route.ts` - Q-learning optimization endpoint

**RL System (The Brain)** 
- `lib/rl/optimizerGeneric.ts` - Main Q-learning loop
- `lib/rl/qlearning.ts` - Q-tables, Bellman updates, epsilon-greedy
- `lib/rl/experience.ts` - Experience replay buffer
- `lib/rl/types.ts` - TypeScript interfaces
- `lib/rl/generic/actions.ts` - Action definitions
- `lib/rl/generic/reward.ts` - Reward calculation
- `lib/rl/generic/state.ts` - State feature extraction

**Generated Data (Proof of Learning)**
- `data/qtable.json` - Learned Q-values (grows over time)
- `data/experiences.json` - Experience replay history
- `data/userHistory.json` - Query tracking

##  Setup

### Prerequisites
- Node.js 18+
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd conversational-dashboard

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Add your OpenAI API key to .env.local
OPENAI_API_KEY=your_key_here

# Run development server
npm run dev

# Open http://localhost:3004
```

### First Run
- Data files (`qtable.json`, `experiences.json`) are created automatically
- Q-table is empty initially - system will explore more
- After 5-10 uses, Q-table fills up and optimization gets faster

##  Key Features

### Domain-Agnostic
Works for anything by adjusting objective constraints:
- **SQL**: Remove subqueries, optimize joins
- **Content**: Professional tone, concise style
- **Code**: Best practices, error handling
- **Analysis**: Data-driven, actionable insights

### Early Stopping
Stops when reward ≥ 70, typically:
- **Cold start**: 5-6 iterations (~20 seconds)
- **After learning**: 3-4 iterations (~10 seconds)

### Editable Objectives
Users can modify the objective JSON before optimization:
```json
{
  "intent": "Optimize SQL query",
  "domain": "sql",
  "constraints": {
    "mustInclude": ["JOIN", "GROUP BY"],
    "mustAvoid": ["subqueries"],
    "tone": "technical"
  },
  "success_criteria": {
    "clarity": 0.9,
    "completeness": 0.95,
    "accuracy": 1.0
  }
}
```

### Debug Panel
Shows real-time RL iteration logs:
- State keys
- Actions selected
- Rewards calculated
- Convergence status

##  Technical Details

**Q-Learning Parameters**
- Learning rate (α): 0.1
- Discount factor (γ): 0.95
- Initial epsilon: 0.2 (20% exploration)
- Max iterations: 6
- Early stopping: reward ≥ 70

**Tech Stack**
- Next.js 16 (Turbopack)
- TypeScript 5
- OpenAI GPT-4o-mini
- React 18
- Tailwind CSS

**API Limits**
- Max tokens per generation: 500
- Temperature: 0.8
- Model: gpt-4o-mini

##  Understanding the Output

**Chat Section**
- Conversation flow
- Basic response (fast, simple)
- RL status messages

**Generated Output Section**
- Final optimized result
- Clean, formatted output
- Result of Q-learning iterations

**Debug Panel**
- Iteration logs
- State keys (hashed features)
- Actions taken
- Rewards earned
- Convergence status

##  Customization

### Change Optimization Speed
Edit `lib/rl/optimizerGeneric.ts`:
```typescript
// Line 273: Early stopping threshold
if (reward.total >= 70)  // Lower = faster, Higher = better quality
```

### Adjust Exploration
Edit `lib/rl/qlearning.ts`:
```typescript
// Line ~10: Initial epsilon
export const INITIAL_EPSILON = 0.2;  // Higher = more exploration
```
