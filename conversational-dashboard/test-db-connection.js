// Test database connection and show schema
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function testConnection() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🔄 Testing database connection...\n');

    // Test connection
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Connected to database at:', result.rows[0].now);
    console.log('📍 Database:', process.env.DATABASE_URL.split('/').pop());

    // Get all tables
    console.log('\n📊 Tables in database:');
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    for (const row of tables.rows) {
      const tableName = row.table_name;
      console.log(`\n  📋 ${tableName}`);

      // Get columns for each table
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      columns.rows.forEach(col => {
        console.log(`     - ${col.column_name} (${col.data_type})`);
      });

      // Get row count
      const count = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
      console.log(`     ℹ️  ${count.rows[0].count} rows`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();
