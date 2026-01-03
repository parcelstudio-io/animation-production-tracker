const express = require('express');
const db = require('../database/db');
const syncService = require('../services/syncService');
const directoryScanner = require('../services/directoryScanner');

const router = express.Router();

// Middleware for API key authentication
const authenticateAPI = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    const expectedKey = process.env.API_SECRET;
    
    if (!expectedKey) {
        console.warn('⚠️  API_SECRET not set - authentication disabled');
        return next();
    }
    
    if (!apiKey || apiKey !== expectedKey) {
        return res.status(401).json({ error: 'Invalid or missing API key' });
    }
    
    next();
};

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Get all production records
router.get('/productions', authenticateAPI, async (req, res) => {
    try {
        const records = await db.getAllRecords();
        res.json({
            success: true,
            data: records,
            count: records.length
        });
    } catch (error) {
        console.error('Error fetching productions:', error);
        res.status(500).json({ error: 'Failed to fetch productions' });
    }
});

// Get productions by type (short-form or long-form)
router.get('/productions/:type', authenticateAPI, async (req, res) => {
    try {
        const { type } = req.params;
        
        if (!['short-form', 'long-form'].includes(type)) {
            return res.status(400).json({ error: 'Invalid project type' });
        }
        
        const records = await db.getRecordsByType(type);
        res.json({
            success: true,
            data: records,
            count: records.length,
            type
        });
    } catch (error) {
        console.error(`Error fetching ${req.params.type} productions:`, error);
        res.status(500).json({ error: 'Failed to fetch productions' });
    }
});

// Get project structure (episodes, scenes, shots)
router.get('/structure', authenticateAPI, async (req, res) => {
    try {
        const structure = directoryScanner.scanDirectoryStructure();
        res.json({
            success: true,
            data: structure,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error scanning directory structure:', error);
        res.status(500).json({ error: 'Failed to scan directory structure' });
    }
});

// Get simplified project lists for dropdowns
router.get('/structure/lists', authenticateAPI, async (req, res) => {
    try {
        const lists = directoryScanner.getEpisodesList();
        res.json({
            success: true,
            data: lists,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting project lists:', error);
        res.status(500).json({ error: 'Failed to get project lists' });
    }
});

// Get scenes for a specific project
router.get('/structure/:projectName/scenes', authenticateAPI, async (req, res) => {
    try {
        const { projectName } = req.params;
        const scenes = directoryScanner.getScenesForProject(projectName);
        res.json({
            success: true,
            data: scenes,
            projectName,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting scenes:', error);
        res.status(500).json({ error: 'Failed to get scenes' });
    }
});

// Get shots for a specific scene
router.get('/structure/:projectName/scenes/:sceneName/shots', authenticateAPI, async (req, res) => {
    try {
        const { projectName, sceneName } = req.params;
        const shots = directoryScanner.getShotsForScene(projectName, sceneName);
        res.json({
            success: true,
            data: shots,
            projectName,
            sceneName,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting shots:', error);
        res.status(500).json({ error: 'Failed to get shots' });
    }
});

// Combined endpoint: Get structure + production data (for page load)
router.get('/page-data', authenticateAPI, async (req, res) => {
    try {
        // Get directory structure
        const structure = directoryScanner.scanDirectoryStructure();
        
        // Get production summary
        const productions = await db.getAllRecords();
        
        res.json({
            success: true,
            data: {
                structure,
                productions,
                stats: {
                    totalEpisodes: structure.episodes.length,
                    totalShortForms: structure.shortForms.length,
                    totalProductions: productions.length,
                    lastUpdate: new Date().toISOString()
                }
            }
        });
    } catch (error) {
        console.error('Error getting page data:', error);
        res.status(500).json({ error: 'Failed to get page data' });
    }
});

// Create new production record
router.post('/productions', authenticateAPI, async (req, res) => {
    try {
        const {
            animator,
            project_type,
            episode_title,
            scene,
            shot,
            week_yyyymmdd,
            status,
            notes,
            railway_id
        } = req.body;

        // Validate required fields
        if (!animator || !project_type || !episode_title || !scene || !shot || !week_yyyymmdd || !status) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate project_type
        if (!['short-form', 'long-form'].includes(project_type)) {
            return res.status(400).json({ error: 'Invalid project type' });
        }

        // Validate status
        if (!['submitted', 'approved', 'revision'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const newRecord = await db.insertRecord({
            animator,
            project_type,
            episode_title,
            scene,
            shot,
            week_yyyymmdd,
            status,
            notes: notes || '',
            railway_id
        });

        // Immediately sync to Railway database
        console.log('🔄 Triggering immediate Railway sync for new record...');
        try {
            const railwaySyncResult = await syncService.syncToRailway();
            console.log('✅ Railway sync completed:', railwaySyncResult);
            
            // After Railway sync, fetch latest data to ensure local DB is current
            const localSyncResult = await syncService.syncFromRailway();
            console.log('✅ Local sync from Railway completed:', localSyncResult);
            
        } catch (syncError) {
            console.error('❌ Real-time sync failed:', syncError.message);
            // Continue with response even if sync fails - the record was still created locally
        }

        // Log the sync action
        await db.logSync({
            sync_type: 'local_to_railway_realtime',
            local_record_id: newRecord.id,
            railway_record_id: railway_id,
            action: 'insert',
            status: 'completed',
            data_snapshot: newRecord
        });

        res.status(201).json({
            success: true,
            data: newRecord,
            synced_to_railway: true
        });
    } catch (error) {
        console.error('Error creating production record:', error);
        res.status(500).json({ error: 'Failed to create production record' });
    }
});

// Update production record
router.put('/productions/:id', authenticateAPI, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Validate project_type if provided
        if (updateData.project_type && !['short-form', 'long-form'].includes(updateData.project_type)) {
            return res.status(400).json({ error: 'Invalid project type' });
        }

        // Validate status if provided
        if (updateData.status && !['submitted', 'approved', 'revision'].includes(updateData.status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const result = await db.updateRecord(id, updateData);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Production record not found' });
        }

        // Immediately sync to Railway database  
        console.log(`🔄 Triggering immediate Railway sync for updated record ${id}...`);
        try {
            const railwaySyncResult = await syncService.syncToRailway();
            console.log('✅ Railway sync completed:', railwaySyncResult);
            
            // After Railway sync, fetch latest data to ensure local DB is current
            const localSyncResult = await syncService.syncFromRailway();
            console.log('✅ Local sync from Railway completed:', localSyncResult);
            
        } catch (syncError) {
            console.error('❌ Real-time sync failed:', syncError.message);
            // Continue with response even if sync fails - the record was still updated locally
        }

        // Log the sync action
        await db.logSync({
            sync_type: 'local_to_railway_realtime',
            local_record_id: parseInt(id),
            railway_record_id: updateData.railway_id,
            action: 'update',
            status: 'completed',
            data_snapshot: updateData
        });

        res.json({
            success: true,
            data: { id: parseInt(id), ...updateData },
            synced_to_railway: true
        });
    } catch (error) {
        console.error('Error updating production record:', error);
        res.status(500).json({ error: 'Failed to update production record' });
    }
});

// Delete production record
router.delete('/productions/:id', authenticateAPI, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.deleteRecord(id);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Production record not found' });
        }

        // Immediately sync to Railway database
        console.log(`🔄 Triggering immediate Railway sync for deleted record ${id}...`);
        try {
            const railwaySyncResult = await syncService.syncToRailway();
            console.log('✅ Railway sync completed:', railwaySyncResult);
            
            // After Railway sync, fetch latest data to ensure local DB is current
            const localSyncResult = await syncService.syncFromRailway();
            console.log('✅ Local sync from Railway completed:', localSyncResult);
            
        } catch (syncError) {
            console.error('❌ Real-time sync failed:', syncError.message);
            // Continue with response even if sync fails - the record was still deleted locally
        }

        // Log the sync action
        await db.logSync({
            sync_type: 'local_to_railway_realtime',
            local_record_id: parseInt(id),
            action: 'delete',
            status: 'completed',
            data_snapshot: { id }
        });

        res.json({
            success: true,
            message: 'Production record deleted',
            synced_to_railway: true
        });
    } catch (error) {
        console.error('Error deleting production record:', error);
        res.status(500).json({ error: 'Failed to delete production record' });
    }
});

// Sync endpoints
// Manual sync endpoint - syncs from Railway database (authoritative)
router.post('/sync/railway-database', authenticateAPI, async (req, res) => {
    try {
        console.log(`🔄 Manual sync from Railway database requested`);
        
        const result = await syncService.syncFromRailway();
        
        res.json({
            success: true,
            message: 'Manual sync from Railway database completed',
            result: result,
            railwayIsAuthoritative: true,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Manual sync from Railway database failed:', error);
        res.status(500).json({ 
            error: 'Failed to sync from Railway database',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Export data for Railway app sync (provides Excel data via API)
router.get('/sync/excel-data', async (req, res) => {
    try {
        console.log(`📤 Railway app requesting Excel data export...`);
        
        // Get all records in Railway-compatible format
        const records = await db.getAllRecords();
        
        // Convert to Railway format
        const railwayFormat = records.map(record => ({
            id: record.railway_id || record.id,
            animator: record.animator,
            project_type: record.project_type,
            episode_title: record.episode_title,
            scene: record.scene,
            shot: record.shot,
            week_yyyymmdd: record.week_yyyymmdd,
            status: record.status,
            notes: record.notes,
            created_at: record.created_at,
            updated_at: record.updated_at
        }));
        
        res.json({
            success: true,
            data: railwayFormat,
            count: railwayFormat.length,
            excel_file_available: true,
            last_modified: new Date().toISOString(),
            source: 'local_excel_file'
        });
        
        console.log(`✅ Excel data exported to Railway: ${railwayFormat.length} records`);
        
    } catch (error) {
        console.error('❌ Error exporting Excel data for Railway:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export Excel data',
            details: error.message,
            excel_file_available: false
        });
    }
});

// DEPRECATED: This endpoint is no longer used (Excel is now authoritative)
router.post('/sync/from-railway', authenticateAPI, async (req, res) => {
    console.log(`⚠️  /sync/from-railway endpoint called but Excel is now authoritative source`);
    
    res.json({
        success: false,
        message: 'Sync direction reversed: Excel file is now authoritative source',
        excelIsAuthoritative: true,
        railwayIsAuthoritative: false,
        deprecatedEndpoint: true,
        newBehavior: 'Railway syncs FROM local Excel file on startup',
        redirectTo: '/api/sync/excel-data',
        timestamp: new Date().toISOString()
    });
});

router.post('/sync/to-railway', authenticateAPI, async (req, res) => {
    try {
        const result = await syncService.syncToRailway();
        res.json({
            success: true,
            message: 'Sync to Railway completed',
            data: result
        });
    } catch (error) {
        console.error('Error syncing to Railway:', error);
        res.status(500).json({ error: 'Failed to sync to Railway' });
    }
});

router.get('/sync/status', authenticateAPI, async (req, res) => {
    try {
        const lastSync = await db.getLastSync();
        res.json({
            success: true,
            data: {
                lastSync,
                nextSync: syncService.getNextSyncTime()
            }
        });
    } catch (error) {
        console.error('Error getting sync status:', error);
        res.status(500).json({ error: 'Failed to get sync status' });
    }
});

// Frontend-compatible endpoints for real-time sync
// These endpoints match what the frontend script.js expects

// Get all production data (frontend format)
router.get('/production-data', async (req, res) => {
    try {
        const records = await db.getAllRecords();
        
        // Convert from database format to frontend format
        const frontendData = records.map(record => ({
            'Animator': record.animator,
            'Project Type': record.project_type,
            'Episode/Title': record.episode_title,
            'Scene': record.scene,
            'Shot': record.shot,
            'Week (YYYYMMDD)': record.week_yyyymmdd,
            'Status': record.status,
            'Notes': record.notes,
            '_id': record.id,
            '_railway_id': record.railway_id
        }));
        
        res.json(frontendData);
    } catch (error) {
        console.error('Error fetching production data:', error);
        res.status(500).json({ error: 'Failed to fetch production data' });
    }
});

// Create new production entry (frontend format)
router.post('/production-data', async (req, res) => {
    try {
        const frontendData = req.body;
        
        // Convert from frontend format to database format
        const dbData = {
            animator: frontendData['Animator'],
            project_type: frontendData['Project Type'],
            episode_title: frontendData['Episode/Title'],
            scene: frontendData['Scene'],
            shot: frontendData['Shot'],
            week_yyyymmdd: frontendData['Week (YYYYMMDD)'],
            status: frontendData['Status'],
            notes: frontendData['Notes'] || ''
        };

        // Validate required fields
        if (!dbData.animator || !dbData.project_type || !dbData.episode_title || 
            !dbData.scene || !dbData.shot || !dbData.week_yyyymmdd || !dbData.status) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create the record locally
        const newRecord = await db.insertRecord(dbData);
        console.log(`📝 Created new production record: ${newRecord.id}`);

        // IMMEDIATELY sync to Railway and back to local
        try {
            const syncResult = await syncService.performRealtimeBidirectionalSync('create');
            
            // Log successful real-time sync
            await db.logSync({
                sync_type: 'realtime_bidirectional',
                local_record_id: newRecord.id,
                action: 'create',
                status: 'completed',
                data_snapshot: syncResult
            });

            res.json({
                success: true,
                message: 'Entry created and synced successfully',
                data: newRecord,
                sync_status: {
                    railway_push: 'completed',
                    railway_pull: 'completed',
                    duration_ms: syncResult.duration_ms,
                    changes_pushed: syncResult.total_changes.pushed,
                    changes_pulled: syncResult.total_changes.pulled
                }
            });

        } catch (syncError) {
            console.error('❌ Real-time sync failed:', syncError.message);
            
            // Log failed sync but still return success for the record creation
            await db.logSync({
                sync_type: 'realtime_bidirectional',
                local_record_id: newRecord.id,
                action: 'create',
                status: 'sync_failed',
                error_message: syncError.message
            });

            res.json({
                success: true,
                message: 'Entry created locally (sync pending)',
                data: newRecord,
                sync_status: {
                    railway_push: 'failed',
                    railway_pull: 'failed',
                    error: syncError.message
                }
            });
        }

    } catch (error) {
        console.error('Error creating production entry:', error);
        res.status(500).json({ error: 'Failed to create production entry' });
    }
});

// Update production entry (frontend format)
router.put('/production-data/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const frontendData = req.body;
        
        // Convert from frontend format to database format
        const dbData = {
            animator: frontendData['Animator'],
            project_type: frontendData['Project Type'],
            episode_title: frontendData['Episode/Title'],
            scene: frontendData['Scene'],
            shot: frontendData['Shot'],
            week_yyyymmdd: frontendData['Week (YYYYMMDD)'],
            status: frontendData['Status'],
            notes: frontendData['Notes'] || ''
        };

        // Update the record locally
        const result = await db.updateRecord(id, dbData);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Production record not found' });
        }

        console.log(`📝 Updated production record: ${id}`);

        // IMMEDIATELY sync to Railway and back to local
        try {
            const syncResult = await syncService.performRealtimeBidirectionalSync('update');
            
            // Log successful real-time sync
            await db.logSync({
                sync_type: 'realtime_bidirectional',
                local_record_id: parseInt(id),
                action: 'update',
                status: 'completed',
                data_snapshot: syncResult
            });

            res.json({
                success: true,
                message: 'Entry updated and synced successfully',
                data: { id: parseInt(id), ...dbData },
                sync_status: {
                    railway_push: 'completed',
                    railway_pull: 'completed',
                    duration_ms: syncResult.duration_ms,
                    changes_pushed: syncResult.total_changes.pushed,
                    changes_pulled: syncResult.total_changes.pulled
                }
            });

        } catch (syncError) {
            console.error('❌ Real-time sync failed:', syncError.message);
            
            // Log failed sync but still return success for the record update
            await db.logSync({
                sync_type: 'realtime_bidirectional',
                local_record_id: parseInt(id),
                action: 'update',
                status: 'sync_failed',
                error_message: syncError.message
            });

            res.json({
                success: true,
                message: 'Entry updated locally (sync pending)',
                data: { id: parseInt(id), ...dbData },
                sync_status: {
                    railway_push: 'failed',
                    railway_pull: 'failed',
                    error: syncError.message
                }
            });
        }

    } catch (error) {
        console.error('Error updating production entry:', error);
        res.status(500).json({ error: 'Failed to update production entry' });
    }
});

// Delete production entry (frontend format)
router.delete('/production-data/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Delete the record locally
        const result = await db.deleteRecord(id);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Production record not found' });
        }

        console.log(`🗑️ Deleted production record: ${id}`);

        // IMMEDIATELY sync to Railway and back to local
        try {
            const syncResult = await syncService.performRealtimeBidirectionalSync('delete');
            
            // Log successful real-time sync
            await db.logSync({
                sync_type: 'realtime_bidirectional',
                local_record_id: parseInt(id),
                action: 'delete',
                status: 'completed',
                data_snapshot: syncResult
            });

            res.json({
                success: true,
                message: 'Entry deleted and synced successfully',
                sync_status: {
                    railway_push: 'completed',
                    railway_pull: 'completed',
                    duration_ms: syncResult.duration_ms,
                    changes_pushed: syncResult.total_changes.pushed,
                    changes_pulled: syncResult.total_changes.pulled
                }
            });

        } catch (syncError) {
            console.error('❌ Real-time sync failed:', syncError.message);
            
            // Log failed sync
            await db.logSync({
                sync_type: 'realtime_bidirectional',
                local_record_id: parseInt(id),
                action: 'delete',
                status: 'sync_failed',
                error_message: syncError.message
            });

            res.json({
                success: true,
                message: 'Entry deleted locally (sync pending)',
                sync_status: {
                    railway_push: 'failed',
                    railway_pull: 'failed',
                    error: syncError.message
                }
            });
        }

    } catch (error) {
        console.error('Error deleting production entry:', error);
        res.status(500).json({ error: 'Failed to delete production entry' });
    }
});

// Excel file export endpoint for Railway app
router.get('/excel-export', authenticateAPI, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        
        const excelPath = path.join(__dirname, '../production_summary.xlsx');
        
        // Check if Excel file exists
        if (!fs.existsSync(excelPath)) {
            return res.status(404).json({ 
                error: 'Excel file not found',
                path: excelPath,
                available: false
            });
        }
        
        // Get file stats
        const stats = fs.statSync(excelPath);
        
        // Set headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="production_summary.xlsx"');
        res.setHeader('Content-Length', stats.size);
        
        // Stream the file
        const fileStream = fs.createReadStream(excelPath);
        fileStream.pipe(res);
        
        console.log(`📤 Excel file exported to Railway: ${excelPath} (${stats.size} bytes)`);
        
    } catch (error) {
        console.error('Error exporting Excel file:', error);
        res.status(500).json({ 
            error: 'Failed to export Excel file',
            details: error.message
        });
    }
});

// Excel file status endpoint 
router.get('/excel-status', authenticateAPI, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        
        const excelPath = path.join(__dirname, '../production_summary.xlsx');
        
        if (fs.existsSync(excelPath)) {
            const stats = fs.statSync(excelPath);
            const records = await db.getAllRecords();
            
            res.json({
                available: true,
                path: excelPath,
                size_bytes: stats.size,
                size_mb: Math.round(stats.size / (1024 * 1024) * 100) / 100,
                last_modified: stats.mtime,
                record_count: records.length,
                readable: true
            });
        } else {
            res.json({
                available: false,
                path: excelPath,
                error: 'Excel file does not exist'
            });
        }
        
    } catch (error) {
        console.error('Error checking Excel status:', error);
        res.status(500).json({ 
            error: 'Failed to check Excel status',
            details: error.message
        });
    }
});

module.exports = router;