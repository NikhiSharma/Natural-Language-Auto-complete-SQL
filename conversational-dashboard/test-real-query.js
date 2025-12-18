// Test real SQL query execution
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function testQuery() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🔄 Testing SQL queries...\n');

    // Test 1: Simple SELECT
    console.log('Test 1: Get all employees');
    const result1 = await pool.query('SELECT * FROM employees');
    console.log('✅ Result:', result1.rows);

    // Test 2: JOIN with departments
    console.log('\nTest 2: Get employees with department names');
    const result2 = await pool.query(`
      SELECT e.name, d.name as department
      FROM employees e
      JOIN departments d ON e.department_id = d.department_id
    `);
    console.log('✅ Result:', result2.rows);

    // Test 3: JOIN with compensation (salary)
    console.log('\nTest 3: Get name and salary of Engineering employees');
    const result3 = await pool.query(`
      SELECT e.name, c.salary, d.name as department
      FROM employees e
      JOIN departments d ON e.department_id = d.department_id
      JOIN compensation c ON e.employee_id = c.employee_id
      WHERE d.name = 'Engineering'
    `);
    console.log('✅ Result:', result3.rows);

    console.log('\n✅ All tests passed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testQuery();
