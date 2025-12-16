# Conversational SQL Analyst  
### Natural Language → Objective Function → Reinforcement-Learned SQL

A conversational analytics system that transforms natural language questions into **correct, semantically valid, and optimized SQL queries** using a **feedback-control reinforcement learning loop** inspired by RunRL / Qwen-style architectures.

Built with **Next.js**, **TypeScript**, and **LLM-driven policy optimization**.

---# Conversational SQL Optimizer  
### Natural Language → Objective Function → Reinforcement-Learned SQL

Built with **Next.js**, **OpenAI GPT-4o-mini**, and a **Q-Learning–based feedback-control optimizer** inspired by **Qwen / RunRL**

---

## Overview

This project explores how natural language analytics can be made **correct, efficient, and self-improving** using reinforcement learning and feedback control.

Instead of directly converting text to SQL, the system follows a multi-stage pipeline:

1. **Natural language → Objective Function**
2. **Objective Function → SQL candidates**
3. **Feedback-control loop (Qwen-style)**
4. **Q-Learning–based optimization**
5. **Converged, semantically correct SQL**

Example:

> “Get all Starbucks and Uber transaction expenses”

The system converges to:

```sql
SELECT * 
FROM transactions 
WHERE merchant_name IN ('Starbucks', 'Uber');
