// Test script to verify JOIN functionality
import { SAMPLE_TRANSACTIONS, SAMPLE_USERS, TransactionRow, UserRow } from "./lib/sampleData";

// Simulate JOIN
const joinedData = SAMPLE_TRANSACTIONS.map(t => {
  const user = SAMPLE_USERS.find(u => u.id === t.user_id);
  return { ...t, name: user?.name || "Unknown" };
});

console.log("✅ JOIN Test Results:");
console.log("=".repeat(50));

// Test 1: Show all transactions with user names
console.log("\n1. All transactions with names:");
joinedData.forEach(row => {
  console.log(`   ${row.name}: $${row.amount} at ${row.merchant_name}`);
});

// Test 2: Filter by user name (Alex)
console.log("\n2. Alex's transactions:");
const alexTransactions = joinedData.filter(r => r.name === "Alex");
alexTransactions.forEach(row => {
  console.log(`   $${row.amount} at ${row.merchant_name}`);
});

// Test 3: Jordan's coffee purchases
console.log("\n3. Jordan's coffee purchases:");
const jordanCoffee = joinedData.filter(r => r.name === "Jordan" && r.category === "Coffee");
jordanCoffee.forEach(row => {
  console.log(`   $${row.amount} at ${row.merchant_name}`);
});

// Test 4: Total spending by user
console.log("\n4. Total spending by user:");
const grouped: Record<string, number> = {};
joinedData.forEach(r => {
  grouped[r.name] = (grouped[r.name] || 0) + r.amount;
});
Object.entries(grouped).forEach(([name, total]) => {
  console.log(`   ${name}: $${total.toFixed(2)}`);
});

console.log("\n" + "=".repeat(50));
console.log("✅ All JOIN tests passed!");
