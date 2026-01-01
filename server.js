const express = require('express');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Import database manager (PostgreSQL for Render)
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

const ROOT_DIR = path.join(__dirname, '../../..');
const PRODUCTION_SUMMARY_PATH = path.join(__dirname, 'production_summary.xlsx');

// Initialize database connection
async function initializeApp() {
    console.log('🚀 Initializing Animation Production Tracker...');
    
    // Initialize database connection
    await db.initialize();
    
    // Initialize Excel file
    initializeExcelFile();
    
    console.log('✅ Application initialized successfully');
}

// [Keep all existing directory scanning functions unchanged]
function scanDirectoryRecursively(dirPath, maxDepth = 5, currentDepth = 0) {
  const results = { episodes: [], shortForms: [] };
  
  if (currentDepth >= maxDepth || !fs.existsSync(dirPath)) {
    return results;
  }
  
  try {
    const items = fs.readdirSync(dirPath);
    
    items.forEach(item => {
      const itemPath = path.join(dirPath, item);
      
      try {
        if (fs.statSync(itemPath).isDirectory()) {
          // Check if this is an episode folder
          if (item.startsWith('Episode_') || /^Episode\s*\d+/i.test(item) || /^\d+.*episode/i.test(item)) {
            console.log(`Found potential episode: ${item} at ${itemPath}`);
            const episode = { name: item, scenes: new Set(), shots: [] };
            scanForScenesAndShots(itemPath, episode, 'episode');
            
            // Add episode even if no scenes found - we want all episodes in dropdown
            episode.scenes = Array.from(episode.scenes).sort();
            results.episodes.push(episode);
          }
          
          // Check if this is a short form folder
          if (/^\d+_/.test(item) || item.toLowerCase().includes('short') || item.toLowerCase().includes('biscuit')) {
            console.log(`Found potential short form: ${item} at ${itemPath}`);
            const shortForm = { name: item, scenes: new Set(), shots: [] };
            scanForScenesAndShots(itemPath, shortForm, 'short');
            
            // Add short form even if no scenes found
            shortForm.scenes = Array.from(shortForm.scenes).sort();
            results.shortForms.push(shortForm);
          }
          
          // Recursively scan subdirectories
          const subResults = scanDirectoryRecursively(itemPath, maxDepth, currentDepth + 1);
          results.episodes.push(...subResults.episodes);
          results.shortForms.push(...subResults.shortForms);
        }
      } catch (statError) {
        console.warn(`Could not stat ${itemPath}:`, statError.message);
      }
    });
  } catch (readError) {
    console.warn(`Could not read directory ${dirPath}:`, readError.message);
  }
  
  return results;
}

function scanForScenesAndShots(projectPath, project, projectType) {
  if (projectType === 'episode') {
    // Long-form: <root_dir>/<episode_name>/03_Production/Shots/<scene_num>/<shot_num>
    // scenes have prefix `sc` and shots have prefix `sh`
    const shotsPath = path.join(projectPath, '03_Production', 'Shots');
    
    if (fs.existsSync(shotsPath)) {
      try {
        const scenes = fs.readdirSync(shotsPath);
        
        scenes.forEach(scene => {
          const scenePath = path.join(shotsPath, scene);
          
          try {
            if (fs.statSync(scenePath).isDirectory() && 
                (scene.toLowerCase().startsWith('sc') || scene.startsWith('SC_'))) {
              console.log(`  Found scene: ${scene}`);
              project.scenes.add(scene);
              
              // Look for shots in this scene
              try {
                const shots = fs.readdirSync(scenePath);
                shots.forEach(shot => {
                  const shotPath = path.join(scenePath, shot);
                  
                  try {
                    if (fs.statSync(shotPath).isDirectory() && 
                        (shot.toLowerCase().startsWith('sh') || shot.startsWith('SH_'))) {
                      console.log(`    Found shot: ${shot} in scene ${scene}`);
                      project.shots.push({ scene, shot });
                    }
                  } catch (shotStatError) {
                    // Ignore stat errors for shots
                  }
                });
              } catch (sceneReadError) {
                console.warn(`Could not read scene contents in ${scenePath}:`, sceneReadError.message);
              }
            }
          } catch (itemStatError) {
            // Ignore stat errors for scenes
          }
        });
      } catch (pathReadError) {
        console.warn(`Could not read shots path ${shotsPath}:`, pathReadError.message);
      }
    } else {
      console.log(`Shots path does not exist: ${shotsPath}`);
    }
  } else if (projectType === 'short') {
    // Short-form: <root_dir>/contents/short_forms/<short_title>/02_layout/<scene_num>_<shot_num>/
    // scenes have prefix `sc` and shots have prefix `sh`
    const layoutPath = path.join(projectPath, '02_layout');
    
    if (fs.existsSync(layoutPath)) {
      try {
        const sceneShots = fs.readdirSync(layoutPath);
        
        sceneShots.forEach(sceneShot => {
          const sceneShotPath = path.join(layoutPath, sceneShot);
          
          try {
            if (fs.statSync(sceneShotPath).isDirectory()) {
              // Parse individual scene_shot format like "sc_01_sh_01"
              const match = sceneShot.match(/^(sc_\d+)_(sh_\d+)$/i);
              if (match) {
                const scene = match[1];
                const shot = match[2];
                
                console.log(`  Found scene-shot: ${sceneShot} -> scene: ${scene}, shot: ${shot}`);
                project.scenes.add(scene);
                project.shots.push({ scene, shot });
              }
            }
          } catch (itemStatError) {
            // Ignore stat errors for scene-shot folders
          }
        });
      } catch (pathReadError) {
        console.warn(`Could not read layout path ${layoutPath}:`, pathReadError.message);
      }
    } else {
      console.log(`Layout path does not exist: ${layoutPath}`);
    }
  }
}

function scanDirectoryStructure() {
  console.log(`\n=== Starting directory scan based on README specification ===`);
  console.log(`Root directory: ${ROOT_DIR}`);
  
  const episodes = [];
  const shortForms = [];
  
  try {
    // LONG-FORM EPISODES: Episode/Title starts with prefix `Episode_` and stored in root directory
    const rootContents = fs.readdirSync(ROOT_DIR);
    rootContents.forEach(item => {
      const itemPath = path.join(ROOT_DIR, item);
      
      try {
        if (fs.statSync(itemPath).isDirectory() && item.startsWith('Episode_')) {
          console.log(`Scanning long-form episode: ${item}`);
          const episode = { name: item, scenes: new Set(), shots: [] };
          scanForScenesAndShots(itemPath, episode, 'episode');
          episode.scenes = Array.from(episode.scenes).sort();
          episodes.push(episode);
        }
      } catch (statError) {
        console.warn(`Could not stat ${itemPath}:`, statError.message);
      }
    });
    
    // SHORT-FORM EPISODES: Start with numeric prefix, stored in contents/short_forms
    const shortFormsPath = path.join(ROOT_DIR, 'contents', 'short_forms');
    
    if (fs.existsSync(shortFormsPath)) {
      try {
        const shortFormContents = fs.readdirSync(shortFormsPath);
        shortFormContents.forEach(item => {
          const itemPath = path.join(shortFormsPath, item);
          
          try {
            // Check if directory starts with numeric prefix (like "02_", "46_", etc.)
            if (fs.statSync(itemPath).isDirectory() && /^\d+_/.test(item) && !item.startsWith('00_')) {
              console.log(`Scanning short-form episode: ${item}`);
              const shortForm = { name: item, scenes: new Set(), shots: [] };
              scanForScenesAndShots(itemPath, shortForm, 'short');
              shortForm.scenes = Array.from(shortForm.scenes).sort();
              shortForms.push(shortForm);
            }
          } catch (statError) {
            console.warn(`Could not stat ${itemPath}:`, statError.message);
          }
        });
      } catch (readError) {
        console.warn(`Could not read short_forms directory ${shortFormsPath}:`, readError.message);
      }
    } else {
      console.log(`Short forms directory not found: ${shortFormsPath}`);
    }
    
  } catch (rootReadError) {
    console.error(`Could not read root directory ${ROOT_DIR}:`, rootReadError.message);
  }
  
  console.log(`\n=== Scan Results ===`);
  console.log(`Found ${episodes.length} long-form episodes:`);
  episodes.forEach(ep => {
    console.log(`  ${ep.name} - ${ep.scenes.length} scenes, ${ep.shots.length} shots`);
  });
  
  console.log(`Found ${shortForms.length} short-form episodes:`);
  shortForms.forEach(sf => {
    console.log(`  ${sf.name} - ${sf.scenes.length} scenes, ${sf.shots.length} shots`);
  });
  
  return { 
    episodes: episodes.sort((a, b) => b.name.localeCompare(a.name)), 
    shortForms: shortForms.sort((a, b) => b.name.localeCompare(a.name)) 
  };
}

function initializeExcelFile() {
  if (!fs.existsSync(PRODUCTION_SUMMARY_PATH)) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Animator', 'Project Type', 'Episode/Title', 'Scene', 'Shot', 'Week (YYYYMMDD)', 'Status', 'Notes']
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Production Summary');
    XLSX.writeFile(wb, PRODUCTION_SUMMARY_PATH);
    console.log('📝 Created Excel file:', PRODUCTION_SUMMARY_PATH);
  }
}

function getMondayDates(count = 10) {
  const mondays = [];
  const today = new Date();
  
  // Find the most recent Monday
  let current = new Date(today);
  const dayOfWeek = current.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
  current.setDate(current.getDate() - daysToSubtract);
  
  // Generate the last 'count' Mondays
  for (let i = 0; i < count; i++) {
    const monday = new Date(current);
    monday.setDate(current.getDate() - (i * 7));
    
    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    const day = String(monday.getDate()).padStart(2, '0');
    
    mondays.push(`${year}${month}${day}`);
  }
  
  return mondays; // Already in descending order
}

// Excel operations (enhanced with database sync)
function readExcelData() {
  try {
    const workbook = XLSX.readFile(PRODUCTION_SUMMARY_PATH);
    const worksheet = workbook.Sheets['Production Summary'];
    return XLSX.utils.sheet_to_json(worksheet);
  } catch (error) {
    console.error('Error reading Excel file:', error);
    return [];
  }
}

function writeExcelData(data) {
  try {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Production Summary');
    XLSX.writeFile(wb, PRODUCTION_SUMMARY_PATH);
    console.log(`📝 Excel file updated with ${data.length} records`);
    return true;
  } catch (error) {
    console.error('Error writing Excel file:', error);
    return false;
  }
}

// Database and Excel sync functions
async function syncToDatabase(entryData, syncType = 'local_to_cloud') {
  if (!db.isEnabled()) {
    return { success: false, message: 'Database not available' };
  }

  try {
    const dbData = {
      animator: entryData.Animator || entryData.animator,
      project_type: entryData['Project Type'] || entryData.project_type,
      episode_title: entryData['Episode/Title'] || entryData.episode_title,
      scene: entryData.Scene || entryData.scene,
      shot: entryData.Shot || entryData.shot,
      week_yyyymmdd: entryData['Week (YYYYMMDD)'] || entryData.week_yyyymmdd,
      status: entryData.Status || entryData.status,
      notes: entryData.Notes || entryData.notes,
      synced_to_local: syncType === 'local_to_cloud'
    };

    const result = await db.insertData(dbData);
    await db.logSync(syncType, result.id, 'insert', 'success', null, entryData);
    
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ Error syncing to database:', error);
    await db.logSync(syncType, null, 'insert', 'failed', error.message, entryData);
    return { success: false, error: error.message };
  }
}

async function syncFromDatabase() {
  if (!db.isEnabled()) {
    return [];
  }

  try {
    const dbData = await db.getAllData();
    
    // Convert database format to Excel format
    const excelData = dbData.map(row => ({
      'Animator': row.animator,
      'Project Type': row.project_type,
      'Episode/Title': row.episode_title,
      'Scene': row.scene,
      'Shot': row.shot,
      'Week (YYYYMMDD)': row.week_yyyymmdd,
      'Status': row.status,
      'Notes': row.notes
    }));

    return excelData;
  } catch (error) {
    console.error('❌ Error syncing from database:', error);
    return [];
  }
}

async function performFullSync() {
  console.log('🔄 Starting full sync between Excel and Database...');
  
  if (!db.isEnabled()) {
    console.log('📝 Database not available, skipping sync');
    return;
  }

  try {
    // Get data from both sources
    const excelData = readExcelData();
    const dbData = await syncFromDatabase();
    
    // Sync Excel → Database
    for (const excelEntry of excelData) {
      await syncToDatabase(excelEntry, 'local_to_cloud');
    }
    
    // Mark all as synced
    const allDbData = await db.getAllData();
    const ids = allDbData.map(row => row.id);
    await db.markAsSynced(ids);
    
    console.log('✅ Full sync completed');
  } catch (error) {
    console.error('❌ Full sync failed:', error);
  }
}

// API Routes
app.get('/api/structure', async (req, res) => {
  console.log('=== /api/structure endpoint called ===');
  
  // Try to get structure from local server first (if available)
  try {
    const localStructure = await queryLocalServerForStructure();
    if (localStructure && localStructure.structure) {
      console.log('✅ Using structure from local server');
      console.log('API /structure returning from local server:', {
        episodeCount: localStructure.structure.episodes.length,
        shortFormCount: localStructure.structure.shortForms.length
      });
      return res.json(localStructure.structure);
    }
  } catch (error) {
    console.warn('⚠️  Failed to get structure from local server:', error.message);
  }
  
  // Fallback to local scanning (for development)
  console.log('📁 Using local directory scanning as fallback');
  const structure = scanDirectoryStructure();
  console.log('API /structure returning from local scan:', {
    episodeCount: structure.episodes.length,
    shortFormCount: structure.shortForms.length
  });
  res.json(structure);
});

app.get('/api/monday-dates', (req, res) => {
  const mondays = getMondayDates();
  res.json(mondays);
});

app.get('/api/debug', (req, res) => {
  console.log('Debug endpoint called');
  console.log('ROOT_DIR:', ROOT_DIR);
  console.log('Directory exists:', fs.existsSync(ROOT_DIR));
  console.log('Database enabled:', db.isEnabled());
  
  if (fs.existsSync(ROOT_DIR)) {
    try {
      const contents = fs.readdirSync(ROOT_DIR);
      console.log('Root directory contents:', contents.slice(0, 10)); // Show first 10 items
      res.json({
        rootDir: ROOT_DIR,
        exists: true,
        contents: contents.slice(0, 20), // Show first 20 items
        databaseEnabled: db.isEnabled(),
        nodeEnv: process.env.NODE_ENV
      });
    } catch (error) {
      res.json({
        rootDir: ROOT_DIR,
        exists: true,
        error: error.message,
        databaseEnabled: db.isEnabled()
      });
    }
  } else {
    res.json({
      rootDir: ROOT_DIR,
      exists: false,
      databaseEnabled: db.isEnabled()
    });
  }
});

// Database connection test endpoint
app.get('/api/db-test', async (req, res) => {
  try {
    if (!db.isEnabled()) {
      return res.json({
        success: false,
        message: 'Database is disabled (Excel-only mode)',
        enabled: false
      });
    }

    // Test database connection
    const result = await db.pool.query('SELECT NOW() as current_time, version() as pg_version');
    
    // Test if our tables exist
    const tableCheck = await db.pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('production_summary', 'sync_log')
    `);
    
    res.json({
      success: true,
      message: 'Database connected successfully',
      timestamp: result.rows[0].current_time,
      version: result.rows[0].pg_version,
      tables: tableCheck.rows.map(row => row.table_name),
      tablesExist: tableCheck.rows.length === 2,
      connectionInfo: {
        host: process.env.PGHOST || 'via DATABASE_URL',
        database: process.env.PGDATABASE || 'via DATABASE_URL',
        ssl: process.env.NODE_ENV === 'production'
      }
    });
  } catch (error) {
    console.error('Database test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      connectionInfo: {
        databaseUrl: !!process.env.DATABASE_URL,
        host: process.env.PGHOST,
        database: process.env.PGDATABASE
      }
    });
  }
});

// Enhanced production data endpoints
app.get('/api/production-data', async (req, res) => {
  try {
    let data = [];
    
    if (db.isEnabled()) {
      // Try to get data from database first
      data = await syncFromDatabase();
      console.log(`📊 Retrieved ${data.length} records from database`);
    } else {
      // Fallback to Excel
      data = readExcelData();
      console.log(`📝 Retrieved ${data.length} records from Excel`);
    }
    
    res.json(data);
  } catch (error) {
    console.error('❌ Error retrieving production data:', error);
    // Fallback to Excel on database error
    const data = readExcelData();
    res.json(data);
  }
});

app.post('/api/production-data', async (req, res) => {
  const newEntry = req.body;
  console.log('📝 New entry received:', newEntry);
  
  try {
    // Always save to Excel first (local persistence)
    const existingData = readExcelData();
    
    // Check for duplicate entry
    const duplicateIndex = existingData.findIndex(item => 
      item.Animator === newEntry.Animator &&
      item['Project Type'] === newEntry['Project Type'] &&
      item['Episode/Title'] === newEntry['Episode/Title'] &&
      item.Scene === newEntry.Scene &&
      item.Shot === newEntry.Shot &&
      item['Week (YYYYMMDD)'] === newEntry['Week (YYYYMMDD)']
    );
    
    let isUpdate = false;
    if (duplicateIndex !== -1) {
      // Duplicate found - update if different
      if (existingData[duplicateIndex].Status !== newEntry.Status) {
        existingData[duplicateIndex].Status = newEntry.Status;
        existingData[duplicateIndex].Notes = newEntry.Notes;
        isUpdate = true;
      } else {
        return res.json({ success: true, updated: false, message: 'Entry already exists with same status' });
      }
    } else {
      // No duplicate, add new entry
      existingData.push(newEntry);
      isUpdate = false;
    }
    
    // Save to Excel
    const excelSuccess = writeExcelData(existingData);
    if (!excelSuccess) {
      return res.status(500).json({ error: 'Failed to save to Excel' });
    }
    
    // Sync to database if available
    let dbResult = null;
    if (db.isEnabled()) {
      dbResult = await syncToDatabase(newEntry, 'local_to_cloud');
      if (dbResult.success) {
        console.log('✅ Successfully synced to database');
      } else {
        console.warn('⚠️  Database sync failed:', dbResult.error);
      }
    }
    
    // Send webhook to cloud if configured
    if (process.env.CLOUD_WEBAPP_URL) {
      try {
        await sendWebhookToCloud('data_updated', newEntry);
      } catch (webhookError) {
        console.warn('⚠️  Webhook failed:', webhookError.message);
      }
    }
    
    // Notify local server if configured
    try {
      await notifyLocalServer(isUpdate ? 'data_updated' : 'data_created', newEntry);
    } catch (localError) {
      console.warn('⚠️  Local server notification failed:', localError.message);
    }
    
    const message = isUpdate ? 'Status updated for existing entry' : 'New entry added';
    res.json({ 
      success: true, 
      updated: isUpdate, 
      message,
      databaseSynced: dbResult?.success || false
    });
    
  } catch (error) {
    console.error('❌ Error processing entry:', error);
    res.status(500).json({ error: 'Failed to save entry' });
  }
});

app.put('/api/production-data/:index', async (req, res) => {
  const index = parseInt(req.params.index);
  const updatedEntry = req.body;
  
  try {
    // Update Excel
    const data = readExcelData();
    if (index >= 0 && index < data.length) {
      data[index] = updatedEntry;
      
      const excelSuccess = writeExcelData(data);
      if (!excelSuccess) {
        return res.status(500).json({ error: 'Failed to update Excel' });
      }
      
      // Sync to database if available
      if (db.isEnabled()) {
        await syncToDatabase(updatedEntry, 'local_to_cloud');
      }
      
      // Notify local server if configured
      try {
        await notifyLocalServer('data_updated', updatedEntry);
      } catch (localError) {
        console.warn('⚠️  Local server notification failed:', localError.message);
      }
      
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Record not found' });
    }
  } catch (error) {
    console.error('❌ Error updating entry:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

app.delete('/api/production-data/:index', async (req, res) => {
  const index = parseInt(req.params.index);
  
  try {
    // Delete from Excel
    const data = readExcelData();
    if (index >= 0 && index < data.length) {
      const deletedEntry = data[index];
      data.splice(index, 1);
      
      const excelSuccess = writeExcelData(data);
      if (!excelSuccess) {
        return res.status(500).json({ error: 'Failed to delete from Excel' });
      }
      
      // TODO: Delete from database if we have a way to identify the record
      // This would require storing database IDs in Excel or using a different approach
      
      res.json({ success: true, message: 'Entry deleted successfully' });
    } else {
      res.status(404).json({ error: 'Record not found' });
    }
  } catch (error) {
    console.error('❌ Error deleting entry:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

app.get('/api/weekly-summary/:week', async (req, res) => {
  const week = req.params.week;
  
  try {
    let data = [];
    
    if (db.isEnabled()) {
      data = await syncFromDatabase();
    } else {
      data = readExcelData();
    }
    
    const weeklyData = data.filter(item => 
      item['Week (YYYYMMDD)'] === week
    );
    
    res.json(weeklyData);
  } catch (error) {
    console.error('❌ Error getting weekly summary:', error);
    const data = readExcelData();
    const weeklyData = data.filter(item => 
      item['Week (YYYYMMDD)'] === week
    );
    res.json(weeklyData);
  }
});

// Sync endpoints
app.post('/api/sync/full', async (req, res) => {
  try {
    await performFullSync();
    res.json({ success: true, message: 'Full sync completed' });
  } catch (error) {
    console.error('❌ Full sync failed:', error);
    res.status(500).json({ error: 'Full sync failed' });
  }
});

app.get('/api/sync/status', (req, res) => {
  res.json({
    databaseEnabled: db.isEnabled(),
    cloudSyncEnabled: !!process.env.CLOUD_WEBAPP_URL,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Webhook endpoints for cloud sync
app.post('/webhook/sync-from-cloud', async (req, res) => {
  try {
    // Verify webhook signature if configured
    const signature = req.headers['x-webhook-signature'];
    if (process.env.WEBHOOK_SECRET && signature) {
      const computedSignature = crypto
        .createHmac('sha256', process.env.WEBHOOK_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');
      
      if (signature !== `sha256=${computedSignature}`) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    
    const { action, data } = req.body;
    console.log('📩 Webhook received:', action);
    
    // Update local Excel file with cloud data
    if (action === 'data_updated' && data) {
      const excelData = readExcelData();
      
      // Find and update or add the entry
      const existingIndex = excelData.findIndex(item => 
        item.Animator === data.Animator &&
        item['Project Type'] === data['Project Type'] &&
        item['Episode/Title'] === data['Episode/Title'] &&
        item.Scene === data.Scene &&
        item.Shot === data.Shot &&
        item['Week (YYYYMMDD)'] === data['Week (YYYYMMDD)']
      );
      
      if (existingIndex !== -1) {
        excelData[existingIndex] = data;
      } else {
        excelData.push(data);
      }
      
      writeExcelData(excelData);
      console.log('✅ Local Excel updated from cloud webhook');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Webhook processing failed:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Helper function to send webhooks to cloud
async function sendWebhookToCloud(action, data) {
  if (!process.env.CLOUD_WEBAPP_URL) {
    return;
  }
  
  try {
    const webhookUrl = `${process.env.CLOUD_WEBAPP_URL}/webhook/sync-from-local`;
    const payload = { action, data };
    
    if (process.env.WEBHOOK_SECRET) {
      const signature = crypto
        .createHmac('sha256', process.env.WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');
      
      await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`
        },
        timeout: 5000
      });
    } else {
      await axios.post(webhookUrl, payload, { timeout: 5000 });
    }
    
    console.log('✅ Webhook sent to cloud successfully');
  } catch (error) {
    console.error('❌ Failed to send webhook to cloud:', error.message);
    throw error;
  }
}

// Local server sync endpoints for Railway → Local communication
// Export endpoint for local server to fetch all production data
app.get('/api/productions/export', async (req, res) => {
  try {
    // Verify API key
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (process.env.LOCAL_SERVER_API_KEY && apiKey !== process.env.LOCAL_SERVER_API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const productions = await db.getAllProductions();
    res.json({
      success: true,
      data: productions,
      timestamp: new Date().toISOString(),
      count: productions.length
    });
  } catch (error) {
    console.error('❌ Failed to export productions:', error);
    res.status(500).json({ error: 'Failed to export productions' });
  }
});

// Sync from local server - when local server pushes updates
app.post('/api/sync/from-local', async (req, res) => {
  try {
    // Verify API key
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (process.env.LOCAL_SERVER_API_KEY && apiKey !== process.env.LOCAL_SERVER_API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const { data } = req.body;
    console.log('📥 Syncing data from local server...');

    let updated = 0;
    let created = 0;

    for (const record of data) {
      try {
        // Check if record exists by unique key combination
        const existingProductions = await db.getAllProductions();
        const existing = existingProductions.find(p => 
          p.animator === record.animator &&
          p.project_type === record.project_type &&
          p.episode_title === record.episode_title &&
          p.scene === record.scene &&
          p.shot === record.shot &&
          p.week_yyyymmdd === record.week_yyyymmdd
        );

        if (existing) {
          // Update existing
          await db.updateProduction(existing.id, record);
          updated++;
        } else {
          // Create new
          await db.createProduction(record);
          created++;
        }
      } catch (recordError) {
        console.error('Error syncing individual record:', recordError);
      }
    }

    console.log(`✅ Local sync complete: ${created} created, ${updated} updated`);
    res.json({
      success: true,
      created,
      updated,
      total: data.length
    });

  } catch (error) {
    console.error('❌ Failed to sync from local server:', error);
    res.status(500).json({ error: 'Failed to sync from local server' });
  }
});

// Notify local server of updates - called when Railway data changes
async function notifyLocalServer(action, data) {
  const localServerUrl = process.env.LOCAL_SERVER_URL;
  const apiKey = process.env.LOCAL_SERVER_API_KEY;
  
  if (!localServerUrl) {
    console.log('ℹ️  Local server URL not configured - skipping notification');
    return;
  }

  try {
    console.log(`📤 Notifying local server: ${action}`);
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    await axios.post(`${localServerUrl}/api/sync/from-railway`, {
      action,
      data
    }, {
      headers,
      timeout: 10000
    });
    
    console.log('✅ Local server notified successfully');
  } catch (error) {
    console.error('❌ Failed to notify local server:', error.message);
  }
}

// Query local server for updated content - called when users visit the app
async function queryLocalServerForUpdates() {
  const localServerUrl = process.env.LOCAL_SERVER_URL;
  const apiKey = process.env.LOCAL_SERVER_API_KEY;
  
  if (!localServerUrl) {
    return null;
  }

  try {
    console.log('🔍 Querying local server for updates...');
    
    const headers = {};
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const response = await axios.get(`${localServerUrl}/api/productions`, {
      headers,
      timeout: 10000
    });
    
    console.log(`📊 Retrieved ${response.data.count} records from local server`);
    return response.data.data;
  } catch (error) {
    console.error('❌ Failed to query local server:', error.message);
    return null;
  }
}

// Query local server for structure data
async function queryLocalServerForStructure() {
  const localServerUrl = process.env.LOCAL_SERVER_URL;
  const apiKey = process.env.LOCAL_SERVER_API_KEY;
  
  if (!localServerUrl) {
    return null;
  }

  try {
    console.log('🔍 Querying local server for structure data...');
    
    const headers = {};
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const response = await axios.get(`${localServerUrl}/api/page-data`, {
      headers,
      timeout: 10000
    });
    
    console.log(`📊 Retrieved structure data from local server`);
    return response.data.data;
  } catch (error) {
    console.error('❌ Failed to query local server for structure:', error.message);
    return null;
  }
}

// Modified production data endpoint to include local server query
const originalGetProductionData = app._router.stack.find(layer => 
  layer.route && layer.route.path === '/api/production-data' && layer.route.methods.get
);

// Query local server when users visit the app
app.get('/api/production-data/with-local-sync', async (req, res) => {
  try {
    // First get regular production data
    const regularData = await db.getAllProductions();
    
    // Then query local server for updates and structure
    const localData = await queryLocalServerForUpdates();
    const localStructure = await queryLocalServerForStructure();
    
    res.json({
      success: true,
      data: regularData,
      localServerData: localData,
      localServerStructure: localStructure,
      localServerConnected: !!(localData || localStructure),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to get production data with local sync:', error);
    res.status(500).json({ error: 'Failed to retrieve data' });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Gracefully shutting down...');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Gracefully shutting down...');
  await db.close();
  process.exit(0);
});

// Start server
initializeApp().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Animation Production Tracker running on http://localhost:${PORT}`);
    console.log(`📊 Database: ${db.isEnabled() ? 'Connected' : 'Disabled (Excel-only mode)'}`);
    console.log(`☁️  Cloud sync: ${process.env.CLOUD_WEBAPP_URL ? 'Enabled' : 'Disabled'}`);
  });
});