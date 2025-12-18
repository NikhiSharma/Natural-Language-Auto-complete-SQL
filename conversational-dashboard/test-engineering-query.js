// Test the exact query that's failing
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function testQuery() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const sql = `SELECT e.name, d.name AS department, c.salary
FROM employees e
JOIN departments d ON e.department_id = d.department_id
JOIN compensation c ON e.employee_id = c.employee_id
WHERE d.name = 'Engineering'`;

    console.log('Executing query:', sql);
    const result = await pool.query(sql);
    console.log('Success! Results:', JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testQuery();
