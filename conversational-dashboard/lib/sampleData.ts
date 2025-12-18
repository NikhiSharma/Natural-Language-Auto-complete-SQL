// lib/sampleData.ts

// Table 1: transactions (with user_id for joining)
export interface TransactionRow {
  id: number;
  user_id: number; // Foreign key to users table
  merchant_name: string;
  amount: number;
  category: string;
  created_at: string;
}

// Table 2: users
export interface UserRow {
  id: number;
  name: string;
}

// Users table data
export const SAMPLE_USERS: UserRow[] = [
  { id: 1, name: "Leila" },
  { id: 2, name: "Alex" },
  { id: 3, name: "Jordan" },
  { id: 4, name: "Taylor" },
  { id: 5, name: "Sam" }
];

// Transactions with user_id foreign keys
export const SAMPLE_TRANSACTIONS: TransactionRow[] = [
  { id: 1, user_id: 1, merchant_name: "Starbucks", amount: 5.95, category: "Coffee", created_at: "2025-01-01T09:00:00Z" },
  { id: 2, user_id: 2, merchant_name: "Amazon", amount: 25.40, category: "Shopping", created_at: "2025-01-01T11:10:00Z" },
  { id: 3, user_id: 3, merchant_name: "McDonalds", amount: 8.25, category: "Food", created_at: "2025-01-02T08:15:00Z" },
  { id: 4, user_id: 4, merchant_name: "Starbucks", amount: 6.50, category: "Coffee", created_at: "2025-01-02T14:20:00Z" },
  { id: 5, user_id: 5, merchant_name: "Uber", amount: 18.75, category: "Transport", created_at: "2025-01-03T16:50:00Z" },
  { id: 6, user_id: 2, merchant_name: "Amazon", amount: 40.10, category: "Shopping", created_at: "2025-01-03T18:00:00Z" },
  { id: 7, user_id: 3, merchant_name: "Local Cafe", amount: 4.90, category: "Coffee", created_at: "2025-01-04T07:40:00Z" },
  { id: 8, user_id: 4, merchant_name: "Target", amount: 32.00, category: "Shopping", created_at: "2025-01-04T20:00:00Z" },
  { id: 9, user_id: 3, merchant_name: "Starbucks", amount: 5.25, category: "Coffee", created_at: "2025-01-05T10:10:00Z" },
  { id: 10, user_id: 2, merchant_name: "Netflix", amount: 15.99, category: "Subscription", created_at: "2025-01-05T22:00:00Z" }
];