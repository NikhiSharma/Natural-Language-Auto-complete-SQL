  # SQL Optimizer 

## Overview

This is a standalone React hook (`useOptimizeSQL`) and API endpoint that optimizes SQL queries using Reinforcement Learning. It works with **any PostgreSQL database** - just point it to your database and it automatically discovers your schema and optimizes queries.

**Live Demo**: https://natural-language-auto-complete-sql.vercel.app/

**Open Source**: Feel free to fork, modify, and use this in your own projects!

---

##  Quick Start

### Prerequisites
- PostgreSQL database (any schema/data)
- Node.js 18+
- OpenAI API key


## 📡 API Endpoint

### Endpoint: `POST /api/optimize-sql`

### Request Format

```json
{
  "objective": {
    "intent": "Get all employees with departments and teams",
    "constraints": {
      "dataSource": "employees_with_departments_with_employee_teams",
      "mustInclude": ["employee_id", "name", "department_name", "teams"]
    }
  },
  "tools": ["explain", "ai"]
}
```

### Available Tools

- `explain` - Runs PostgreSQL EXPLAIN to analyze performance
- `ai` - Uses RL optimization to find best SQL

### Response Format

```json
{
  "sql": "WITH employee_team_agg AS (...) SELECT ...",
  "analysis": {
    "estimatedRows": 10,
    "estimatedCost": 45.5,
    "fields": ["employee_id", "name", "department_name", "teams"],
    "usesIndex": true,
    "hasAggregation": true
  },
  "optimizationMetadata": {
    "iterations": 5,
    "finalReward": 115,
    "iterationLogs": [...]
  },
  "message": "Fully optimized - SQL meets all constraints"
}
```

### Example API Call (PowerShell)

```powershell
$body = @{
    objective = @{
        intent = "Get all employees with departments"
        constraints = @{
            dataSource = "employees_with_departments"
            mustInclude = @("employee_id", "name", "department_name")
        }
    }
    tools = @("explain", "ai")
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:3004/api/optimize-sql" -Method POST -ContentType "application/json" -Body $body
```

### Example API Call (JavaScript)

```javascript
const response = await fetch('http://localhost:3004/api/optimize-sql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    objective: {
      intent: "Get all orders with customer details",
      constraints: {
        dataSource: "orders_with_customers",
        mustInclude: ["order_id", "customer_name", "total"]
      }
    },
    tools: ["explain", "ai"]
  })
});

const result = await response.json();
console.log(result.sql);
```

---

##  React Hook Usage

### Basic Example

```tsx
import { useOptimizeSQL } from '@/lib/hooks/useOptimizeSQL';

function MyComponent() {
  const { optimizeSQL, loading, result } = useOptimizeSQL({
    apiEndpoint: "https://natural-language-auto-complete-sql.vercel.app/api/optimize-sql"
  });

  const handleOptimize = async () => {
    const result = await optimizeSQL({
      intent: "Your natural language query description",
      constraints: {
        dataSource: "table1_with_table2_with_table3",
        mustInclude: ["field1", "field2", "field3"]
      }
    });

    console.log("Optimized SQL:", result.sql);
  };

  return (
    <button onClick={handleOptimize} disabled={loading}>
      {loading ? "Optimizing..." : "Optimize SQL"}
    </button>
  );
}
```

### Advanced Example with Progress Tracking

```tsx
function AdvancedComponent() {
  const {
    optimizeSQL,
    loading,
    result,
    error,
    progress
  } = useOptimizeSQL({
    tools: ["explain", "ai"],

    // Track each RL iteration
    onProgress: (log) => {
      console.log(`Iteration ${log.iteration}: Reward ${log.reward}`);
    },

    // Called when complete
    onComplete: (result) => {
      console.log(" Done!", result.sql);
    },

    // Called on error
    onError: (error) => {
      console.error(" Failed:", error.message);
    }
  });

  return (
    <div>
      <button onClick={() => optimizeSQL(objective)}>
        Optimize
      </button>

      {/* Show real-time progress */}
      {progress.map((log, i) => (
        <div key={i}>
          Iteration {log.iteration}: {log.passed ? "✓" : "✗"}
          (Reward: {log.reward})
        </div>
      ))}

      {/* Show result */}
      {result && <pre>{result.sql}</pre>}
    </div>
  );
}
```

### Hook Options

```typescript
useOptimizeSQL({
  // Which tools to use
  tools: ["explain", "ai", "execute"],

  // Callbacks
  onProgress: (log) => { },
  onComplete: (result) => { },
  onError: (error) => { },

  // Custom endpoint (for deployed API)
  apiEndpoint: "https://your-app.vercel.app/api/optimize-sql"
})
```

### Hook Return Values

```typescript
{
  optimizeSQL: (objective) => Promise<OptimizationResult>,
  loading: boolean,
  result: OptimizationResult | null,
  error: Error | null,
  progress: ProgressLog[],
  reset: () => void
}
```

---

##  Deployment


### Using the Live API

You can use the live API endpoint directly without deploying anything:

```tsx
// Use the live API endpoint
const { optimizeSQL } = useOptimizeSQL({
  apiEndpoint: "https://natural-language-auto-complete-sql.vercel.app/api/optimize-sql"
});
```

**Example API Call:**
```javascript
const response = await fetch('https://natural-language-auto-complete-sql.vercel.app/api/optimize-sql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    objective: {
      intent: "Get all employees with departments",
      constraints: {
        dataSource: "employees_with_departments",
        mustInclude: ["employee_id", "name", "department_name"]
      }
    },
    tools: ["explain", "ai"]
  })
});

const result = await response.json();
console.log(result.sql);
```

---

##  Real-World Examples

### Example 1: E-commerce Database

```tsx
const result = await optimizeSQL({
  intent: "Get all orders with customer and items",
  constraints: {
    dataSource: "orders_with_customers_with_order_items",
    mustInclude: ["order_id", "customer_name", "items", "total"]
  }
});
```

### Example 2: Disney Movies Database

```tsx
const result = await optimizeSQL({
  intent: "Get all Disney movies with cast",
  constraints: {
    dataSource: "movies_with_movie_cast_with_actors",
    mustInclude: ["movie_id", "title", "actors", "roles"]
  }
});

// Returns optimized SQL like:
// WITH actor_agg AS (
//   SELECT movie_id,
//          ARRAY_AGG(name) as actors,
//          ARRAY_AGG(role) as roles
//   FROM movie_cast mc
//   JOIN actors a ON mc.actor_id = a.actor_id
//   GROUP BY movie_id
// )
// SELECT m.movie_id, m.title, aa.actors, aa.roles
// FROM movies m
// LEFT JOIN actor_agg aa ON m.movie_id = aa.movie_id
```

### Example 3: Blog Platform

```tsx
const result = await optimizeSQL({
  intent: "Get posts with author and comment count",
  constraints: {
    dataSource: "posts_with_authors_with_comments",
    mustInclude: ["post_id", "title", "author_name", "comment_count"]
  }
});
```

---

##  Key Features

✅ **Works with ANY PostgreSQL database** - Just set DATABASE_URL
✅ **Automatic schema discovery** - No manual configuration needed
✅ **CTE optimization** - Rewards CTEs with ARRAY_AGG for one-to-many relationships
✅ **EXPLAIN analysis** - Analyzes performance without executing
✅ **Reinforcement Learning** - Uses Q-Learning to find optimal queries
✅ **Progress tracking** - Real-time iteration updates
✅ **Type-safe** - Full TypeScript support

---

##  How It Works

1. **You provide an objective** - Natural language description + constraints
2. **AI generates SQL candidates** - Uses RL to try different approaches
3. **Reward system scores each attempt** - Rewards CTEs, JOINs, aggregation
4. **EXPLAIN analyzes performance** - Checks row count, cost, index usage
5. **Returns best query** - Optimized SQL that meets all constraints

**The RL system rewards:**
- CTEs with aggregation (+40 points)
- ARRAY_AGG with GROUP BY (+25 points)
- Proper JOINs (+20 points)
- Index usage (+10 points)
- Clean, readable SQL


**To use this:**

### Option 1: Use the Live API (No Setup Required)
Just call the live endpoint at:
```
https://natural-language-auto-complete-sql.vercel.app/api/optimize-sql
```

### Option 2: Deploy Your Own Instance
1. **Set your DATABASE_URL** to any PostgreSQL database
2. **Call your own API** or use the React hook
3. **Get optimized SQL** automatically!

The system works with **any PostgreSQL schema**

---

**Live Demo**: https://natural-language-auto-complete-sql.vercel.app/
