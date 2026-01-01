const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT || 5432,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

async function runMigration() {
    const pool = new Pool(dbConfig);
    
    try {
        console.log('🚀 Starting database migration...');
        console.log('📊 Connecting to database:', { host: dbConfig.host, database: dbConfig.database });
        
        // Test connection
        const client = await pool.connect();
        console.log('✅ Database connection successful');
        
        // Read and execute schema
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('📝 Executing schema...');
        await client.query(schemaSql);
        console.log('✅ Schema created successfully');
        
        // Check if we need to migrate existing Excel data
        const existingDataCheck = await client.query('SELECT COUNT(*) FROM production_summary');
        const rowCount = parseInt(existingDataCheck.rows[0].count);
        
        if (rowCount === 0) {
            console.log('📋 No existing data found. Checking for Excel file to migrate...');
            await migrateExcelData(client);
        } else {
            console.log(`📊 Found ${rowCount} existing records in database`);
        }
        
        client.release();
        console.log('🎉 Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

async function migrateExcelData(client) {
    const excelPath = path.join(__dirname, '..', 'production_summary.xlsx');
    
    if (!fs.existsSync(excelPath)) {
        console.log('📝 No existing Excel file found. Starting with empty database.');
        return;
    }
    
    try {
        const XLSX = require('xlsx');
        const workbook = XLSX.readFile(excelPath);
        const worksheet = workbook.Sheets['Production Summary'];
        const excelData = XLSX.utils.sheet_to_json(worksheet);
        
        if (excelData.length === 0) {
            console.log('📝 Excel file is empty. Starting with clean database.');
            return;
        }
        
        console.log(`📊 Found ${excelData.length} records in Excel file. Migrating...`);
        
        for (let i = 0; i < excelData.length; i++) {
            const row = excelData[i];
            
            try {
                await client.query(`
                    INSERT INTO production_summary 
                    (animator, project_type, episode_title, scene, shot, week_yyyymmdd, status, notes, synced_to_local)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (animator, project_type, episode_title, scene, shot, week_yyyymmdd) 
                    DO UPDATE SET 
                        status = EXCLUDED.status,
                        notes = EXCLUDED.notes,
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    row.Animator || '',
                    row['Project Type'] || '',
                    row['Episode/Title'] || '',
                    row.Scene || '',
                    row.Shot || '',
                    row['Week (YYYYMMDD)'] || '',
                    row.Status || '',
                    row.Notes || '',
                    true // Mark as synced to local since it came from local Excel
                ]);
                
                if ((i + 1) % 10 === 0) {
                    console.log(`📊 Migrated ${i + 1}/${excelData.length} records...`);
                }
                
            } catch (rowError) {
                console.warn(`⚠️  Skipped row ${i + 1} due to error:`, rowError.message);
            }
        }
        
        console.log('✅ Excel data migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Error migrating Excel data:', error.message);
        // Don't fail the entire migration if Excel migration fails
    }
}

// Run migration if called directly
if (require.main === module) {
    runMigration();
}

module.exports = { runMigration };