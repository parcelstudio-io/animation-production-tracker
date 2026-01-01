const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

class SQLiteManager {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'production_tracker.db');
        this.db = null;
        this.isConnected = false;
    }

    async initialize() {
        if (process.env.ENABLE_CLOUD_SYNC === 'false') {
            console.log('📝 Database sync disabled. Using Excel-only mode.');
            return;
        }

        try {
            console.log('🗃️  Initializing SQLite database...');
            
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Error opening database:', err);
                    this.isConnected = false;
                } else {
                    console.log('✅ SQLite database connected');
                    this.isConnected = true;
                }
            });

            // Create tables
            await this.createTables();
            console.log('✅ Database initialization completed');

        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            this.isConnected = false;
        }
    }

    createTables() {
        return new Promise((resolve, reject) => {
            const createTablesSQL = `
                CREATE TABLE IF NOT EXISTS production_summary (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    animator TEXT NOT NULL,
                    project_type TEXT NOT NULL CHECK (project_type IN ('long-form', 'short-form')),
                    episode_title TEXT NOT NULL,
                    scene TEXT NOT NULL,
                    shot TEXT NOT NULL,
                    week_yyyymmdd TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('submitted', 'approved', 'revision')),
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    synced_to_local BOOLEAN DEFAULT FALSE,
                    UNIQUE(animator, project_type, episode_title, scene, shot, week_yyyymmdd)
                );

                CREATE TABLE IF NOT EXISTS sync_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sync_type TEXT NOT NULL CHECK (sync_type IN ('cloud_to_local', 'local_to_cloud')),
                    record_id INTEGER,
                    action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
                    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
                    error_message TEXT,
                    excel_row_data TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    completed_at DATETIME
                );

                CREATE INDEX IF NOT EXISTS idx_production_summary_week ON production_summary(week_yyyymmdd);
                CREATE INDEX IF NOT EXISTS idx_production_summary_animator ON production_summary(animator);
                CREATE INDEX IF NOT EXISTS idx_production_summary_sync ON production_summary(synced_to_local);
                CREATE INDEX IF NOT EXISTS idx_production_summary_updated ON production_summary(updated_at);
                CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(status, created_at);
            `;

            this.db.exec(createTablesSQL, (err) => {
                if (err) {
                    console.error('❌ Error creating tables:', err);
                    reject(err);
                } else {
                    console.log('✅ Database tables created successfully');
                    resolve();
                }
            });
        });
    }

    async query(sql, params = []) {
        if (!this.isConnected || !this.db) {
            throw new Error('Database not connected');
        }

        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async run(sql, params = []) {
        if (!this.isConnected || !this.db) {
            throw new Error('Database not connected');
        }

        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async getAllData() {
        if (!this.isConnected) {
            return [];
        }

        try {
            const rows = await this.query(`
                SELECT id, animator, project_type, episode_title, scene, shot, 
                       week_yyyymmdd, status, notes, created_at, updated_at
                FROM production_summary 
                ORDER BY updated_at DESC
            `);
            return rows;
        } catch (error) {
            console.error('❌ Error fetching data from database:', error);
            return [];
        }
    }

    async insertData(data) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        const sql = `
            INSERT OR REPLACE INTO production_summary 
            (animator, project_type, episode_title, scene, shot, week_yyyymmdd, status, notes, synced_to_local)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await this.run(sql, [
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

        return { id: result.id, created_at: new Date(), updated_at: new Date() };
    }

    async updateData(id, data) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        const sql = `
            UPDATE production_summary 
            SET animator = ?, project_type = ?, episode_title = ?, scene = ?, 
                shot = ?, week_yyyymmdd = ?, status = ?, notes = ?,
                updated_at = CURRENT_TIMESTAMP, synced_to_local = ?
            WHERE id = ?
        `;

        const result = await this.run(sql, [
            data.animator,
            data.project_type,
            data.episode_title,
            data.scene,
            data.shot,
            data.week_yyyymmdd,
            data.status,
            data.notes,
            data.synced_to_local || false,
            id
        ]);

        return { id: id, updated_at: new Date() };
    }

    async deleteData(id) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        const result = await this.run(`DELETE FROM production_summary WHERE id = ?`, [id]);
        return { id: id };
    }

    async logSync(syncType, recordId, action, status, errorMessage = null, excelRowData = null) {
        if (!this.isConnected) {
            return;
        }

        try {
            await this.run(`
                INSERT INTO sync_log (sync_type, record_id, action, status, error_message, excel_row_data)
                VALUES (?, ?, ?, ?, ?, ?)
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
            const rows = await this.query(`
                SELECT * FROM production_summary 
                WHERE synced_to_local = 0
                ORDER BY updated_at ASC
            `);
            return rows;
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
            const placeholders = ids.map(() => '?').join(',');
            await this.run(`
                UPDATE production_summary 
                SET synced_to_local = 1 
                WHERE id IN (${placeholders})
            `, ids);
        } catch (error) {
            console.error('❌ Error marking records as synced:', error);
        }
    }

    isEnabled() {
        return this.isConnected;
    }

    async close() {
        if (this.db && this.isConnected) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        console.error('❌ Error closing database:', err);
                    } else {
                        console.log('🔌 SQLite database connection closed');
                    }
                    this.isConnected = false;
                    resolve();
                });
            });
        }
    }
}

// Create singleton instance
const db = new SQLiteManager();

module.exports = db;