const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class DatabaseManager {
    constructor() {
        this.pool = null;
        this.isCloudEnabled = process.env.ENABLE_CLOUD_SYNC === 'true';
        this.isConnected = false;
    }

    async initialize() {
        if (!this.isCloudEnabled) {
            console.log('📝 Cloud sync disabled. Using Excel-only mode.');
            return;
        }

        try {
            // Database configuration with Railway support
            const dbConfig = process.env.DATABASE_URL ? {
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                // Connection pool settings
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            } : {
                host: process.env.DB_HOST || process.env.PGHOST,
                database: process.env.DB_NAME || process.env.PGDATABASE,
                user: process.env.DB_USER || process.env.PGUSER,
                password: process.env.DB_PASS || process.env.PGPASSWORD,
                port: process.env.DB_PORT || process.env.PGPORT || 5432,
                // SSL configuration for Railway/production
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                // Connection pool settings
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            };

            console.log('🔌 Initializing database connection...');
            console.log('📊 Database config:', { 
                host: dbConfig.host, 
                database: dbConfig.database, 
                user: dbConfig.user,
                ssl: !!dbConfig.ssl 
            });

            this.pool = new Pool(dbConfig);

            // Test connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            this.isConnected = true;
            console.log('✅ Database connection successful');

            // Set up connection error handling
            this.pool.on('error', (err) => {
                console.error('💥 Unexpected database error:', err);
                this.isConnected = false;
            });

        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            console.log('📝 Falling back to Excel-only mode');
            this.isConnected = false;
            this.isCloudEnabled = false;
        }
    }

    async query(text, params) {
        if (!this.isConnected || !this.pool) {
            throw new Error('Database not connected');
        }
        return this.pool.query(text, params);
    }

    async getAllData() {
        if (!this.isConnected) {
            return [];
        }

        try {
            const result = await this.query(`
                SELECT id, animator, project_type, episode_title, scene, shot, 
                       week_yyyymmdd, status, notes, created_at, updated_at
                FROM production_summary 
                ORDER BY updated_at DESC
            `);
            return result.rows;
        } catch (error) {
            console.error('❌ Error fetching data from database:', error);
            return [];
        }
    }

    async insertData(data) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        const result = await this.query(`
            INSERT INTO production_summary 
            (animator, project_type, episode_title, scene, shot, week_yyyymmdd, status, notes, synced_to_local)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (animator, project_type, episode_title, scene, shot, week_yyyymmdd) 
            DO UPDATE SET 
                status = EXCLUDED.status,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP,
                synced_to_local = EXCLUDED.synced_to_local
            RETURNING id, created_at, updated_at
        `, [
            data.animator,
            data.project_type,
            data.episode_title,
            data.scene,
            data.shot,
            data.week_yyyymmdd,
            data.status,
            data.notes,
            data.synced_to_local || false
        ]);

        return result.rows[0];
    }

    async updateData(id, data) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        const result = await this.query(`
            UPDATE production_summary 
            SET animator = $2, project_type = $3, episode_title = $4, scene = $5, 
                shot = $6, week_yyyymmdd = $7, status = $8, notes = $9,
                updated_at = CURRENT_TIMESTAMP, synced_to_local = $10
            WHERE id = $1
            RETURNING id, updated_at
        `, [
            id,
            data.animator,
            data.project_type,
            data.episode_title,
            data.scene,
            data.shot,
            data.week_yyyymmdd,
            data.status,
            data.notes,
            data.synced_to_local || false
        ]);

        return result.rows[0];
    }

    async deleteData(id) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        const result = await this.query(`
            DELETE FROM production_summary 
            WHERE id = $1
            RETURNING id
        `, [id]);

        return result.rows[0];
    }

    async logSync(syncType, recordId, action, status, errorMessage = null, excelRowData = null) {
        if (!this.isConnected) {
            return;
        }

        try {
            await this.query(`
                INSERT INTO sync_log (sync_type, record_id, action, status, error_message, excel_row_data)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [syncType, recordId, action, status, errorMessage, excelRowData ? JSON.stringify(excelRowData) : null]);
        } catch (error) {
            console.error('❌ Error logging sync:', error);
        }
    }

    async getUnsyncedRecords() {
        if (!this.isConnected) {
            return [];
        }

        try {
            const result = await this.query(`
                SELECT * FROM production_summary 
                WHERE synced_to_local = false
                ORDER BY updated_at ASC
            `);
            return result.rows;
        } catch (error) {
            console.error('❌ Error fetching unsynced records:', error);
            return [];
        }
    }

    async markAsSynced(ids) {
        if (!this.isConnected || !ids.length) {
            return;
        }

        try {
            const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
            await this.query(`
                UPDATE production_summary 
                SET synced_to_local = true 
                WHERE id IN (${placeholders})
            `, ids);
        } catch (error) {
            console.error('❌ Error marking records as synced:', error);
        }
    }

    // Alias methods for consistency with server.js calls
    async getAllProductions() {
        return this.getAllData();
    }

    async createProduction(data) {
        return this.insertData(data);
    }

    async updateProduction(id, data) {
        return this.updateData(id, data);
    }

    async deleteProduction(id) {
        return this.deleteData(id);
    }

    isEnabled() {
        return this.isCloudEnabled && this.isConnected;
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            console.log('🔌 Database connection closed');
        }
    }
}

// Create singleton instance
const db = new DatabaseManager();

module.exports = db;