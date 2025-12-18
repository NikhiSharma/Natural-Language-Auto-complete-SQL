import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export type DetailedSchema = {
  tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      default?: string | null;
    }>;
  }>;
  relationships: Array<{
    from: string;
    to: string;
  }>;
};

let cachedSchema: DetailedSchema | null = null;

/**
 * Introspect PostgreSQL database schema
 * Returns tables, columns, data types, and foreign key relationships
 */
export async function introspectSchema(): Promise<DetailedSchema> {
  // Return cached schema if available
  if (cachedSchema) {
    return cachedSchema;
  }

  try {
    // Get all tables
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const schema: DetailedSchema = {
      tables: [],
      relationships: [],
    };

    // For each table, get columns and their types
    for (const row of tablesResult.rows) {
      const tableName = row.table_name;

      const columnsResult = await pool.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      schema.tables.push({
        name: tableName,
        columns: columnsResult.rows.map((col: any) => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          default: col.column_default,
        })),
      });
    }

    // Get foreign key relationships
    const fkResult = await pool.query(`
      SELECT
        tc.table_name as from_table,
        kcu.column_name as from_column,
        ccu.table_name as to_table,
        ccu.column_name as to_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    `);

    schema.relationships = fkResult.rows.map((fk: any) => ({
      from: `${fk.from_table}.${fk.from_column}`,
      to: `${fk.to_table}.${fk.to_column}`,
    }));

    console.log("[Schema Introspection] Successfully introspected database schema");
    console.log(`[Schema Introspection] Found ${schema.tables.length} tables`);
    console.log(`[Schema Introspection] Found ${schema.relationships.length} relationships`);

    // Cache the schema
    cachedSchema = schema;

    return schema;

  } catch (err: any) {
    console.error("[Schema Introspection Error]:", err.message);
    throw new Error(`Failed to introspect schema: ${err.message}`);
  }
}
