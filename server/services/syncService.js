const axios = require('axios');
const db = require('../database/db');
const durationService = require('./durationService');

class SyncService {
    constructor() {
        this.railwayUrl = process.env.RAILWAY_APP_URL;
        this.apiSecret = process.env.API_SECRET;
        this.syncInterval = parseInt(process.env.SYNC_INTERVAL_MINUTES) || 5;
        this.autoSync = process.env.ENABLE_AUTO_SYNC === 'true';
        this.syncTimer = null;
        this.isSyncing = false;
    }

    init() {
        if (this.autoSync && this.railwayUrl) {
            console.log(`🔄 Auto-sync enabled - syncing every ${this.syncInterval} minutes`);
            console.log(`📊 Local Excel file will be treated as authoritative source`);
            console.log(`📡 Railway database will be synchronized FROM local Excel file`);
            this.startAutoSync();
            
            // Perform initial sync on startup - sync TO Railway FROM Excel
            this.performInitialSync();
        } else {
            console.log('ℹ️  Auto-sync disabled or Railway URL not configured');
            console.log('💡 To enable auto-sync: set ENABLE_AUTO_SYNC=true and RAILWAY_APP_URL');
        }
    }

    async performInitialSync() {
        console.log('🚀 Performing initial sync TO Railway FROM local Excel file...');
        try {
            await this.syncToRailway();
            console.log('✅ Initial sync completed successfully - Railway updated with Excel data');
        } catch (error) {
            console.error('❌ Initial sync failed:', error.message);
            console.log('⏰ Will retry on next scheduled sync');
        }
    }

    startAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }

        this.syncTimer = setInterval(async () => {
            if (!this.isSyncing) {
                console.log(`⏰ Scheduled sync starting (Local Excel as authoritative source)...`);
                await this.performExcelToRailwaySync();
            } else {
                console.log(`⏳ Sync already in progress, skipping scheduled sync`);
            }
        }, this.syncInterval * 60 * 1000);
    }

    async performExcelToRailwaySync() {
        if (this.isSyncing) {
            console.log('⏳ Sync already in progress, skipping...');
            return;
        }

        this.isSyncing = true;
        console.log('🔄 Starting Excel-to-Railway sync (Excel is authoritative)...');
        
        try {
            await db.updateStatus('last_sync_attempt', new Date().toISOString());

            // Only sync TO Railway FROM Excel (Excel is authoritative)
            const result = await this.syncToRailway();
            
            await db.updateStatus('last_successful_sync', new Date().toISOString());
            
            console.log('✅ Excel-to-Railway sync completed successfully');
            console.log(`📊 Sync summary: Railway database updated with local Excel data`);
            
            return result;
        } catch (error) {
            console.error('❌ Excel-to-Railway sync failed:', error);
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    async performRailwaySync() {
        if (this.isSyncing) {
            console.log('⏳ Sync already in progress, skipping...');
            return;
        }

        this.isSyncing = true;
        console.log('🔄 Starting Railway database sync (authoritative)...');
        
        try {
            await db.updateStatus('last_sync_attempt', new Date().toISOString());

            // Only sync FROM Railway (Railway is authoritative)
            const result = await this.syncFromRailway();
            
            await db.updateStatus('last_successful_sync', new Date().toISOString());
            
            console.log('✅ Railway database sync completed successfully');
            console.log(`📊 Sync summary: ${result.total} total records, ${result.created} new, ${result.updated} updated, ${result.removed} removed`);
            
            return result;
        } catch (error) {
            console.error('❌ Railway database sync failed:', error);
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    stopAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            console.log('🛑 Auto-sync stopped');
        }
    }

    async performBidirectionalSync() {
        if (this.isSyncing) {
            console.log('⏳ Sync already in progress, skipping...');
            return;
        }

        this.isSyncing = true;
        console.log('🔄 Starting bidirectional sync...');
        
        try {
            await db.updateStatus('last_sync_attempt', new Date().toISOString());

            // First sync from Railway (get latest updates)
            const fromRailwayResult = await this.syncFromRailway();
            
            // Then sync to Railway (push local changes)
            const toRailwayResult = await this.syncToRailway();

            await db.updateStatus('last_successful_sync', new Date().toISOString());
            
            console.log('✅ Bidirectional sync completed successfully');
            return {
                fromRailway: fromRailwayResult,
                toRailway: toRailwayResult
            };
        } catch (error) {
            console.error('❌ Bidirectional sync failed:', error);
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    async syncFromRailway() {
        if (!this.railwayUrl) {
            throw new Error('Railway URL not configured');
        }

        console.log('📥 Syncing data from Railway database (authoritative source)...');
        
        try {
            const response = await axios.get(`${this.railwayUrl}/api/productions/export`, {
                headers: {
                    'x-api-key': this.apiSecret
                },
                timeout: 30000
            });

            const railwayRecords = response.data.data || [];
            console.log(`📊 Retrieved ${railwayRecords.length} records from Railway database`);
            
            // Get all local records
            const localRecords = await db.getAllRecords();
            console.log(`📊 Found ${localRecords.length} local records`);
            
            // Convert Railway records to local format for full replacement
            const convertedRecords = railwayRecords.map(record => ({
                id: localRecords.find(l => l.railway_id === record.id)?.id || Date.now() + Math.random(),
                animator: record.animator || '',
                project_type: record.project_type || '',
                episode_title: record.episode_title || '',
                scene: record.scene || '',
                shot: record.shot || '',
                week_yyyymmdd: record.week_yyyymmdd || '',
                status: record.status || '',
                notes: record.notes || '',
                railway_id: record.id,
                created_at: record.created_at || new Date().toISOString(),
                updated_at: record.updated_at || new Date().toISOString()
            }));

            console.log('🔄 Performing full sync (Railway database as authoritative source)');
            console.log(`📝 Will replace local Excel with ${convertedRecords.length} records from Railway`);
            
            // Detect differences for logging
            const differences = this.detectDifferences(localRecords, convertedRecords);
            console.log(`🔍 Sync differences: ${differences.added.length} added, ${differences.updated.length} updated, ${differences.removed.length} removed`);
            
            // Replace local data entirely with Railway data (Railway is authoritative)
            await db.replaceAllRecords(convertedRecords);
            
            console.log('✅ Local Excel file synchronized with Railway database');
            
            // Check animation durations for the synced records
            console.log('🎬 Starting duration analysis for synced records...');
            try {
                const recordsWithDurations = await durationService.checkAnimationDurations(convertedRecords);
                console.log(`✅ Duration analysis completed for ${recordsWithDurations.length} records`);
                
                // Log duration analysis results
                const durationSummary = this.summarizeDurationResults(recordsWithDurations);
                console.log('📊 Duration Analysis Summary:');
                console.log(`  - Records with valid durations: ${durationSummary.valid_count}`);
                console.log(`  - Records with errors: ${durationSummary.error_count}`);
                console.log(`  - Total animation duration: ${durationSummary.total_duration_formatted}`);
                console.log(`  - Total frames needed: ${durationSummary.total_frames}`);
                
                // Store duration results in database for future reference
                await db.logSync({
                    sync_type: 'duration_analysis',
                    action: 'duration_check',
                    status: 'completed',
                    data_snapshot: {
                        duration_summary: durationSummary,
                        analysis_timestamp: new Date().toISOString()
                    }
                });
                
            } catch (durationError) {
                console.error('❌ Duration analysis failed:', durationError);
                await db.logSync({
                    sync_type: 'duration_analysis',
                    action: 'duration_check',
                    status: 'failed',
                    error_message: durationError.message
                });
            }
            
            // Log sync details
            await db.logSync({
                sync_type: 'railway_to_local_full',
                action: 'full_sync',
                status: 'success',
                data_snapshot: {
                    railwayCount: railwayRecords.length,
                    localCount: localRecords.length,
                    syncedCount: convertedRecords.length,
                    differences: differences
                }
            });

            return {
                created: differences.added.length,
                updated: differences.updated.length,
                removed: differences.removed.length,
                total: convertedRecords.length,
                railwayRecords: railwayRecords.length,
                localRecords: localRecords.length,
                synchronized: true
            };

        } catch (error) {
            console.error('❌ Failed to sync from Railway:', error);
            await db.logSync({
                sync_type: 'railway_to_local_full',
                action: 'full_sync',
                status: 'failed',
                error_message: error.message
            });
            throw error;
        }
    }

    detectDifferences(localRecords, railwayRecords) {
        const added = [];
        const updated = [];
        const removed = [];

        // Find records in Railway that are new or updated
        railwayRecords.forEach(railwayRecord => {
            const localRecord = localRecords.find(l => l.railway_id === railwayRecord.railway_id);
            
            if (!localRecord) {
                added.push(railwayRecord);
            } else {
                // Check if updated (compare key fields)
                const isUpdated = 
                    localRecord.status !== railwayRecord.status ||
                    localRecord.notes !== railwayRecord.notes ||
                    localRecord.animator !== railwayRecord.animator ||
                    localRecord.project_type !== railwayRecord.project_type ||
                    localRecord.episode_title !== railwayRecord.episode_title ||
                    localRecord.scene !== railwayRecord.scene ||
                    localRecord.shot !== railwayRecord.shot ||
                    localRecord.week_yyyymmdd !== railwayRecord.week_yyyymmdd;
                
                if (isUpdated) {
                    updated.push({
                        local: localRecord,
                        railway: railwayRecord
                    });
                }
            }
        });

        // Find local records that are no longer in Railway (should be removed)
        localRecords.forEach(localRecord => {
            if (localRecord.railway_id && !railwayRecords.find(r => r.id === localRecord.railway_id)) {
                removed.push(localRecord);
            }
        });

        return { added, updated, removed };
    }

    summarizeDurationResults(recordsWithDurations) {
        let validCount = 0;
        let errorCount = 0;
        let totalDurationSeconds = 0;
        let totalFrames = 0;
        
        recordsWithDurations.forEach(record => {
            if (record.duration_info && record.duration_info.status === 'success') {
                validCount++;
                totalDurationSeconds += record.duration_info.total_duration_seconds || record.duration_info.duration_seconds || 0;
                totalFrames += record.duration_info.total_duration_frames || record.duration_info.duration_frames || 0;
            } else {
                errorCount++;
            }
        });
        
        const totalMinutes = Math.floor(totalDurationSeconds / 60);
        const remainingSeconds = totalDurationSeconds % 60;
        const totalDurationFormatted = `${totalMinutes}:${remainingSeconds.toFixed(2).padStart(5, '0')}`;
        
        return {
            valid_count: validCount,
            error_count: errorCount,
            total_duration_seconds: totalDurationSeconds,
            total_duration_formatted: totalDurationFormatted,
            total_frames: totalFrames,
            average_duration: validCount > 0 ? totalDurationSeconds / validCount : 0
        };
    }

    async syncToRailway() {
        if (!this.railwayUrl) {
            throw new Error('Railway URL not configured');
        }

        console.log('📤 Syncing data to Railway...');
        
        try {
            // Get all local records that need syncing
            const localRecords = await db.getAllRecords();
            const recordsToSync = localRecords.filter(record => 
                !record.last_synced || 
                new Date(record.updated_at) > new Date(record.last_synced)
            );

            let updated = 0;
            let created = 0;
            const errors = [];

            for (const record of recordsToSync) {
                try {
                    const syncData = {
                        animator: record.animator,
                        project_type: record.project_type,
                        episode_title: record.episode_title,
                        scene: record.scene,
                        shot: record.shot,
                        week_yyyymmdd: record.week_yyyymmdd,
                        status: record.status,
                        notes: record.notes
                    };

                    let response;
                    
                    if (record.railway_id) {
                        // Update existing record on Railway
                        response = await axios.put(
                            `${this.railwayUrl}/api/productions/${record.railway_id}`,
                            syncData,
                            {
                                headers: { 'x-api-key': this.apiSecret },
                                timeout: 30000
                            }
                        );
                        updated++;
                    } else {
                        // Create new record on Railway
                        response = await axios.post(
                            `${this.railwayUrl}/api/productions`,
                            syncData,
                            {
                                headers: { 'x-api-key': this.apiSecret },
                                timeout: 30000
                            }
                        );
                        
                        // Update local record with Railway ID
                        const railwayId = response.data.data.id;
                        await db.updateRecord(record.id, {
                            ...record,
                            railway_id: railwayId
                        });
                        created++;
                    }

                    // Log successful sync
                    await db.logSync({
                        sync_type: 'local_to_railway',
                        railway_record_id: record.railway_id || response.data.data.id,
                        local_record_id: record.id,
                        action: record.railway_id ? 'update' : 'insert',
                        status: 'success',
                        data_snapshot: record
                    });

                } catch (recordError) {
                    console.error(`Error syncing local record ${record.id}:`, recordError);
                    errors.push({ recordId: record.id, error: recordError.message });
                    
                    await db.logSync({
                        sync_type: 'local_to_railway',
                        railway_record_id: record.railway_id,
                        local_record_id: record.id,
                        action: record.railway_id ? 'update' : 'insert',
                        status: 'failed',
                        error_message: recordError.message,
                        data_snapshot: record
                    });
                }
            }

            console.log(`📤 Local to Railway sync complete: ${created} created, ${updated} updated, ${errors.length} errors`);
            
            return {
                created,
                updated,
                errors,
                total: recordsToSync.length
            };

        } catch (error) {
            console.error('❌ Failed to sync to Railway:', error);
            throw error;
        }
    }

    getNextSyncTime() {
        if (!this.autoSync || !this.syncTimer) {
            return null;
        }
        
        const nextSync = new Date();
        nextSync.setMinutes(nextSync.getMinutes() + this.syncInterval);
        return nextSync.toISOString();
    }

    async performRealtimeBidirectionalSync(action = 'unknown') {
        if (this.isSyncing) {
            console.log('⏳ Sync already in progress, queuing real-time sync...');
            // Wait a bit and try again
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (this.isSyncing) {
                throw new Error('Sync service is busy, please try again');
            }
        }

        this.isSyncing = true;
        const syncStartTime = Date.now();
        
        console.log(`🚀 Starting real-time bidirectional sync for ${action}...`);
        
        try {
            // 1. Push local changes to Railway (local is source of truth for this change)
            console.log('📤 Step 1: Pushing local changes to Railway...');
            const pushResult = await this.syncToRailway();
            console.log(`✅ Push completed: ${pushResult.created} created, ${pushResult.updated} updated`);
            
            // 2. Pull latest data from Railway to catch any concurrent changes
            console.log('📥 Step 2: Pulling latest data from Railway...');
            const pullResult = await this.syncFromRailway();
            console.log(`✅ Pull completed: ${pullResult.created} created, ${pullResult.updated} updated, ${pullResult.removed} removed`);
            
            const syncDuration = Date.now() - syncStartTime;
            
            console.log(`⚡ Real-time bidirectional sync completed in ${syncDuration}ms`);
            
            return {
                success: true,
                duration_ms: syncDuration,
                push_result: pushResult,
                pull_result: pullResult,
                total_changes: {
                    pushed: pushResult.created + pushResult.updated,
                    pulled: pullResult.created + pullResult.updated + pullResult.removed
                }
            };

        } catch (error) {
            console.error(`❌ Real-time bidirectional sync failed for ${action}:`, error);
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }
}

module.exports = new SyncService();