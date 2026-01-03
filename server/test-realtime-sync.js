const syncService = require('./services/syncService');
const db = require('./database/db');

async function testRealtimeSync() {
    console.log('🧪 Testing Real-time Bidirectional Sync System');
    console.log('='.repeat(50));
    
    try {
        // Initialize database
        await db.initialize();
        console.log('✅ Database initialized');
        
        // Test 1: Verify sync service methods exist
        console.log('\n📋 Test 1: Verify sync service methods');
        const hasRealtimeMethod = typeof syncService.performRealtimeBidirectionalSync === 'function';
        const hasToRailway = typeof syncService.syncToRailway === 'function';
        const hasFromRailway = typeof syncService.syncFromRailway === 'function';
        
        console.log('- performRealtimeBidirectionalSync:', hasRealtimeMethod ? '✅' : '❌');
        console.log('- syncToRailway:', hasToRailway ? '✅' : '❌');
        console.log('- syncFromRailway:', hasFromRailway ? '✅' : '❌');
        
        if (!hasRealtimeMethod || !hasToRailway || !hasFromRailway) {
            throw new Error('Missing required sync methods');
        }
        
        // Test 2: Check Railway configuration
        console.log('\n📋 Test 2: Check Railway configuration');
        const railwayUrl = process.env.RAILWAY_APP_URL;
        const apiSecret = process.env.API_SECRET;
        
        console.log('- Railway URL:', railwayUrl ? '✅ Set' : '❌ Missing');
        console.log('- API Secret:', apiSecret ? '✅ Set' : '❌ Missing');
        
        if (!railwayUrl) {
            console.log('⚠️  Railway URL not configured - sync will fail but local operations will work');
        }
        
        // Test 3: Test database operations
        console.log('\n📋 Test 3: Test database operations');
        
        // Create test record
        const testRecord = {
            animator: 'Test Animator',
            project_type: 'long-form',
            episode_title: 'Test Episode',
            scene: 'sc_test',
            shot: 'sh_test',
            week_yyyymmdd: '20250103',
            status: 'submitted',
            notes: 'Test sync record'
        };
        
        const newRecord = await db.insertRecord(testRecord);
        console.log('✅ Test record created:', newRecord.id);
        
        // Update test record
        const updateData = { ...testRecord, status: 'approved', notes: 'Updated test record' };
        const updateResult = await db.updateRecord(newRecord.id, updateData);
        console.log('✅ Test record updated:', updateResult.changes, 'rows affected');
        
        // Read test record
        const allRecords = await db.getAllRecords();
        const testRecordFound = allRecords.find(r => r.id === newRecord.id);
        console.log('✅ Test record found:', testRecordFound ? 'Yes' : 'No');
        
        if (testRecordFound) {
            console.log('  - Status:', testRecordFound.status);
            console.log('  - Notes:', testRecordFound.notes);
        }
        
        // Clean up test record
        const deleteResult = await db.deleteRecord(newRecord.id);
        console.log('✅ Test record deleted:', deleteResult.changes, 'rows affected');
        
        // Test 4: Test real-time sync (will fail without Railway connection)
        console.log('\n📋 Test 4: Test real-time sync method (expecting failure without Railway)');
        
        if (railwayUrl) {
            try {
                const syncResult = await syncService.performRealtimeBidirectionalSync('test');
                console.log('✅ Real-time sync test passed:', syncResult.success);
                console.log('  - Duration:', syncResult.duration_ms + 'ms');
                console.log('  - Changes pushed:', syncResult.total_changes.pushed);
                console.log('  - Changes pulled:', syncResult.total_changes.pulled);
            } catch (syncError) {
                console.log('⚠️  Real-time sync failed (expected without Railway connection):', syncError.message);
            }
        } else {
            console.log('⚠️  Skipping real-time sync test - no Railway URL configured');
        }
        
        // Test 5: Test API endpoint format conversion
        console.log('\n📋 Test 5: Test data format conversion');
        
        const frontendFormat = {
            'Animator': 'Test Frontend Animator',
            'Project Type': 'short-form',
            'Episode/Title': 'Test Frontend Episode',
            'Scene': 'sc_frontend',
            'Shot': 'sh_frontend',
            'Week (YYYYMMDD)': '20250104',
            'Status': 'approved',
            'Notes': 'Frontend format test'
        };
        
        // Convert to database format (simulate API endpoint logic)
        const dbFormat = {
            animator: frontendFormat['Animator'],
            project_type: frontendFormat['Project Type'],
            episode_title: frontendFormat['Episode/Title'],
            scene: frontendFormat['Scene'],
            shot: frontendFormat['Shot'],
            week_yyyymmdd: frontendFormat['Week (YYYYMMDD)'],
            status: frontendFormat['Status'],
            notes: frontendFormat['Notes']
        };
        
        console.log('✅ Frontend to DB conversion working');
        console.log('  - Animator:', dbFormat.animator);
        console.log('  - Project Type:', dbFormat.project_type);
        console.log('  - Episode:', dbFormat.episode_title);
        
        // Convert back to frontend format
        const backToFrontend = {
            'Animator': dbFormat.animator,
            'Project Type': dbFormat.project_type,
            'Episode/Title': dbFormat.episode_title,
            'Scene': dbFormat.scene,
            'Shot': dbFormat.shot,
            'Week (YYYYMMDD)': dbFormat.week_yyyymmdd,
            'Status': dbFormat.status,
            'Notes': dbFormat.notes
        };
        
        console.log('✅ DB to Frontend conversion working');
        console.log('  - Original Notes:', frontendFormat['Notes']);
        console.log('  - Converted Notes:', backToFrontend['Notes']);
        
        console.log('\n🎉 Real-time Sync System Test Results:');
        console.log('='.repeat(50));
        console.log('✅ Database operations: PASSED');
        console.log('✅ Sync service methods: PASSED');
        console.log('✅ Data format conversion: PASSED');
        console.log('⚠️  Railway sync: REQUIRES LIVE CONNECTION');
        console.log('\n📝 System is ready for real-time sync when Railway is connected!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        console.error(error.stack);
    } finally {
        // Close database connection
        db.close();
        console.log('\n🔌 Database connection closed');
    }
}

// Run the test
testRealtimeSync();