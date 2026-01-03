class ProductionTracker {
    constructor() {
        this.directoryStructure = null;
        this.productionData = [];
        this.currentEditIndex = -1;
        this.init();
    }

    async init() {
        // SCENARIO 1: User visits/refreshes page - fetch all data including from local server
        await this.loadPageData();
        await this.loadMondayDates();
        this.setupEventListeners();
        await this.showLatestWeekByDefault();
    }

    async loadPageData() {
        try {
            console.log('🔄 Page refresh detected - syncing from Excel file...');
            
            // Load Railway data first (may be outdated)
            await this.loadDirectoryStructure();
            await this.loadProductionData();
            
            // 🎯 CRITICAL: Sync Railway database FROM Excel file (Excel is authoritative)
            await this.fetchFromLocalServer();
            
        } catch (error) {
            console.error('Error loading page data:', error);
        }
    }

    async fetchFromLocalServer() {
        try {
            console.log('📥 Syncing from local Excel file (authoritative source)...');
            
            // Call the Railway endpoint that syncs from local Excel file
            const response = await fetch('/api/production-data/with-local-sync');
            const result = await response.json();
            
            if (result.success) {
                // Show sync status
                if (result.localServerConnected && result.syncFromExcel?.success) {
                    console.log(`✅ Excel sync successful - ${result.syncFromExcel.recordsCount} records`);
                    console.log('📊 Railway database updated with Excel data');
                    
                    // Reload production data (now synced with Excel)
                    await this.loadProductionData();
                    this.renderTable();
                    
                    // Update structure data if local server provided it
                    if (result.localServerStructure && result.localServerStructure.structure) {
                        console.log('📁 Updating directory structure from local server');
                        this.directoryStructure = result.localServerStructure.structure;
                        this.populateProjectDropdown(); // Refresh dropdowns with new structure
                    }
                    
                    // Show success indicator with sync details
                    this.showSyncStatus(true, `Excel sync: ${result.syncFromExcel.recordsCount} records`, result.syncFromExcel);
                    
                } else {
                    console.log('⚠️ Local server not available - using existing Railway data');
                    this.showSyncStatus(false, 'Excel file not accessible', {
                        success: false,
                        message: result.syncFromExcel?.message || 'Local server not available'
                    });
                }
            } else {
                console.error('❌ Failed to sync from Excel file');
                this.showSyncStatus(false, 'Excel sync failed', {
                    success: false,
                    error: result.error || 'Unknown error'
                });
            }
            
        } catch (error) {
            console.error('❌ Excel sync error:', error);
            this.showSyncStatus(false, 'Excel sync error', {
                success: false,
                error: error.message
            });
        }
    }

    mergeProductionData(localData) {
        if (!localData || localData.length === 0) return;
        
        // Create a map of Railway data for efficient lookup
        const railwayDataMap = new Map();
        this.productionData.forEach((item, index) => {
            const key = `${item.Animator}-${item['Project Type']}-${item['Episode/Title']}-${item.Scene}-${item.Shot}-${item['Week (YYYYMMDD)']}`;
            railwayDataMap.set(key, { item, index });
        });
        
        // Process local server data
        localData.forEach(localItem => {
            // Convert local server format to Railway format
            const railwayFormat = {
                'Animator': localItem.animator,
                'Project Type': localItem.project_type,
                'Episode/Title': localItem.episode_title,
                'Scene': localItem.scene,
                'Shot': localItem.shot,
                'Week (YYYYMMDD)': localItem.week_yyyymmdd,
                'Status': localItem.status,
                'Notes': localItem.notes || ''
            };
            
            const key = `${railwayFormat.Animator}-${railwayFormat['Project Type']}-${railwayFormat['Episode/Title']}-${railwayFormat.Scene}-${railwayFormat.Shot}-${railwayFormat['Week (YYYYMMDD)']}`;
            
            // Update existing or add new
            if (railwayDataMap.has(key)) {
                const existing = railwayDataMap.get(key);
                this.productionData[existing.index] = railwayFormat;
            } else {
                this.productionData.push(railwayFormat);
            }
        });
        
        console.log(`✅ Merged production data: ${this.productionData.length} total records`);
    }

    showLocalServerStatus(connected, message) {
        // Legacy method - redirect to new sync status method
        this.showSyncStatus(connected, message, { success: connected });
    }

    showSyncStatus(success, message, details) {
        // Create or update sync status indicator
        let statusDiv = document.getElementById('excel-sync-status');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'excel-sync-status';
            statusDiv.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 12px 16px;
                border-radius: 6px;
                font-size: 13px;
                color: white;
                z-index: 1000;
                transition: all 0.3s;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                max-width: 320px;
                cursor: pointer;
            `;
            document.body.appendChild(statusDiv);
            
            // Click to show details
            statusDiv.addEventListener('click', () => {
                this.showSyncDetails(details);
            });
        }
        
        const icon = success ? '✅' : '⚠️';
        const bgColor = success ? '#28a745' : '#dc3545';
        
        statusDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">${icon}</span>
                <div>
                    <div style="font-weight: 600;">${success ? 'Excel Sync' : 'Sync Warning'}</div>
                    <div style="font-size: 11px; opacity: 0.9;">${message}</div>
                </div>
            </div>
        `;
        
        statusDiv.style.backgroundColor = bgColor;
        statusDiv.style.opacity = '1';
        
        // Auto-fade after 5 seconds for success, stay visible for warnings
        if (success) {
            setTimeout(() => {
                statusDiv.style.opacity = '0.8';
            }, 5000);
        }
    }

    showSyncDetails(details) {
        if (!details) return;
        
        let message = '📊 Excel Sync Details\n\n';
        
        if (details.success) {
            message += `✅ Status: Success\n`;
            message += `📄 Records: ${details.recordsCount || 'Unknown'}\n`;
            message += `🎯 Source: Local Excel File (Authoritative)\n`;
            message += `📡 Target: Railway Database\n`;
            message += `⏰ Time: ${new Date().toLocaleTimeString()}\n\n`;
            message += `${details.message || 'Railway database synchronized with Excel file'}`;
        } else {
            message += `❌ Status: Failed\n`;
            message += `🔗 Local Server: Not Available\n`;
            message += `📊 Fallback: Using Railway Data\n`;
            message += `⚠️ Warning: Data may not be current\n\n`;
            message += `Error: ${details.error || details.message || 'Unknown error'}`;
        }
        
        alert(message);
    }

    async syncToLocalServer(data, action) {
        try {
            console.log(`📤 Syncing ${action} to local server...`);
            
            // The Railway server will handle posting to local server automatically
            // via the notifyLocalServer() function we added to the server routes
            // This is just to show a status update to the user
            
            const statusMessage = {
                'create': 'New entry synced to local server',
                'update': 'Update synced to local server', 
                'delete': 'Deletion synced to local server'
            }[action] || 'Synced to local server';
            
            // Show temporary sync status
            this.showLocalServerStatus(true, statusMessage);
            
        } catch (error) {
            console.warn(`Failed to sync ${action} to local server:`, error);
            this.showLocalServerStatus(false, `Sync failed: ${action}`);
        }
    }

    async loadDirectoryStructure() {
        try {
            console.log('Fetching directory structure...');
            const response = await fetch('/api/structure');
            this.directoryStructure = await response.json();
            console.log('Directory structure loaded:', this.directoryStructure);
            console.log('Episodes found:', this.directoryStructure.episodes.length);
            console.log('Short forms found:', this.directoryStructure.shortForms.length);
            this.populateProjectDropdown();
        } catch (error) {
            console.error('Error loading directory structure:', error);
        }
    }

    async loadProductionData() {
        try {
            const response = await fetch('/api/production-data');
            this.productionData = await response.json();
            
            // Populate episode filter dropdown after data loads
            this.populateEpisodeFilterDropdown();
        } catch (error) {
            console.error('Error loading production data:', error);
        }
    }

    async loadMondayDates() {
        try {
            const response = await fetch('/api/monday-dates');
            const mondays = await response.json();
            this.populateWeekDropdown(mondays);
        } catch (error) {
            console.error('Error loading Monday dates:', error);
        }
    }

    populateWeekDropdown(mondays) {
        const weekSelect = document.getElementById('week');
        weekSelect.innerHTML = '<option value="">Select Week</option>';
        
        mondays.forEach(monday => {
            const option = document.createElement('option');
            option.value = monday;
            option.textContent = monday;
            weekSelect.appendChild(option);
        });
        
        // Store latest week for default filtering
        this.latestWeek = mondays[0]; // First Monday is the latest
    }

    async showLatestWeekByDefault() {
        if (this.latestWeek) {
            // Set the week filter input to the latest week
            document.getElementById('weekFilter').value = this.latestWeek;
            
            // Load and display data for the latest week
            await this.filterByWeek();
            
            // Update navigation button states
            this.updateNavigationButtons();
        } else {
            // Fallback to showing all data if no latest week available
            this.renderTable();
        }
    }

    populateProjectDropdown() {
        const projectTypeSelect = document.getElementById('projectType');
        const episodeSelect = document.getElementById('episode');
        const sceneSelect = document.getElementById('scene');
        const shotSelect = document.getElementById('shot');

        projectTypeSelect.addEventListener('change', () => {
            episodeSelect.innerHTML = '<option value="">Select Episode/Title</option>';
            
            if (projectTypeSelect.value === 'long-form') {
                // Show ALL episodes, regardless of whether they have scenes/shots
                this.directoryStructure.episodes.forEach(episode => {
                    const option = document.createElement('option');
                    option.value = episode.name;
                    option.textContent = episode.name;
                    episodeSelect.appendChild(option);
                });
                episodeSelect.disabled = false;
            } else if (projectTypeSelect.value === 'short-form') {
                // Show ALL short forms
                this.directoryStructure.shortForms.forEach(shortForm => {
                    const option = document.createElement('option');
                    option.value = shortForm.name;
                    option.textContent = shortForm.name;
                    episodeSelect.appendChild(option);
                });
                episodeSelect.disabled = false;
            } else {
                episodeSelect.disabled = true;
            }
            
            this.clearSceneShot();
            sceneSelect.disabled = true;
            shotSelect.disabled = true;
        });

        episodeSelect.addEventListener('change', () => {
            if (episodeSelect.value) {
                this.populateScenes();
                // populateScenes() will handle enabling/disabling the scene dropdown
            } else {
                this.clearSceneShot();
                sceneSelect.disabled = true;
                shotSelect.disabled = true;
            }
        });
    }

    populateScenes() {
        const projectType = document.getElementById('projectType').value;
        const episodeName = document.getElementById('episode').value;
        const sceneSelect = document.getElementById('scene');
        const shotSelect = document.getElementById('shot');

        sceneSelect.innerHTML = '<option value="">Select Scene</option>';

        if (projectType === 'long-form') {
            const episode = this.directoryStructure.episodes.find(ep => ep.name === episodeName);
            if (episode && episode.scenes.length > 0) {
                episode.scenes.forEach(scene => {
                    const option = document.createElement('option');
                    option.value = scene;
                    option.textContent = scene;
                    sceneSelect.appendChild(option);
                });
                sceneSelect.disabled = false; // Enable scene dropdown
            } else {
                sceneSelect.disabled = true; // Keep disabled if no scenes
            }
        } else if (projectType === 'short-form') {
            const shortForm = this.directoryStructure.shortForms.find(sf => sf.name === episodeName);
            if (shortForm && shortForm.scenes.length > 0) {
                shortForm.scenes.forEach(scene => {
                    const option = document.createElement('option');
                    option.value = scene;
                    option.textContent = scene;
                    sceneSelect.appendChild(option);
                });
                sceneSelect.disabled = false; // Enable scene dropdown
            } else {
                sceneSelect.disabled = true; // Keep disabled if no scenes
            }
        }

        // Add event listener for scene changes
        this.setupSceneChangeListener();
        
        this.clearShots();
        shotSelect.disabled = true;
    }
    
    setupSceneChangeListener() {
        const sceneSelect = document.getElementById('scene');
        const shotSelect = document.getElementById('shot');
        
        // Remove any existing event listeners by cloning
        const newSceneSelect = sceneSelect.cloneNode(true);
        sceneSelect.parentNode.replaceChild(newSceneSelect, sceneSelect);
        
        // Add fresh event listener
        newSceneSelect.addEventListener('change', () => {
            if (newSceneSelect.value) {
                this.populateShots();
                shotSelect.disabled = false;
            } else {
                this.clearShots();
                shotSelect.disabled = true;
            }
        });
    }

    populateShots() {
        const projectType = document.getElementById('projectType').value;
        const episodeName = document.getElementById('episode').value;
        const sceneName = document.getElementById('scene').value;
        const shotSelect = document.getElementById('shot');

        shotSelect.innerHTML = '<option value="">Select Shot</option>';

        let shotsAdded = false;

        if (projectType === 'long-form' && this.directoryStructure?.episodes) {
            const episode = this.directoryStructure.episodes.find(ep => ep.name === episodeName);
            if (episode) {
                const sceneShots = episode.shots.filter(shot => shot.scene === sceneName);
                // Sort shots naturally (SH_01, SH_02, etc.)
                sceneShots.sort((a, b) => {
                    const aNum = parseInt(a.shot.replace(/\D+/g, ''));
                    const bNum = parseInt(b.shot.replace(/\D+/g, ''));
                    return aNum - bNum;
                });
                sceneShots.forEach(shotData => {
                    const option = document.createElement('option');
                    option.value = shotData.shot;
                    option.textContent = shotData.shot;
                    shotSelect.appendChild(option);
                });
                shotsAdded = sceneShots.length > 0;
            }
        } else if (projectType === 'short-form' && this.directoryStructure?.shortForms) {
            const shortForm = this.directoryStructure.shortForms.find(sf => sf.name === episodeName);
            if (shortForm) {
                const sceneShots = shortForm.shots.filter(shot => shot.scene === sceneName);
                // Sort shots naturally
                sceneShots.sort((a, b) => {
                    const aNum = parseInt(a.shot.replace(/\D+/g, ''));
                    const bNum = parseInt(b.shot.replace(/\D+/g, ''));
                    return aNum - bNum;
                });
                sceneShots.forEach(shotData => {
                    const option = document.createElement('option');
                    option.value = shotData.shot;
                    option.textContent = shotData.shot;
                    shotSelect.appendChild(option);
                });
                shotsAdded = sceneShots.length > 0;
            }
        }

        // If no shots were found from directory structure, provide default shot options
        if (!shotsAdded) {
            this.addDefaultShotOptions(shotSelect);
        }
    }

    addDefaultShotOptions(shotSelect) {
        // Add comprehensive shot options (30+ shots)
        const defaultShots = [
            'SH_01', 'SH_02', 'SH_03', 'SH_04', 'SH_05', 'SH_06', 'SH_07', 'SH_08', 'SH_09', 'SH_10',
            'SH_11', 'SH_12', 'SH_13', 'SH_14', 'SH_15', 'SH_16', 'SH_17', 'SH_18', 'SH_19', 'SH_20',
            'SH_21', 'SH_22', 'SH_23', 'SH_24', 'SH_25', 'SH_26', 'SH_27', 'SH_28', 'SH_29', 'SH_30',
            'SH_31', 'SH_32', 'SH_33', 'SH_34', 'SH_35', 'SH_36', 'SH_37', 'SH_38', 'SH_39', 'SH_40',
            'SH_41', 'SH_42', 'SH_43', 'SH_44', 'SH_45', 'SH_46', 'SH_47', 'SH_48', 'SH_49', 'SH_50'
        ];

        defaultShots.forEach(shotName => {
            const option = document.createElement('option');
            option.value = shotName;
            option.textContent = shotName;
            shotSelect.appendChild(option);
        });

        console.log(`📹 Added ${defaultShots.length} default shot options`);
    }

    clearSceneShot() {
        document.getElementById('scene').innerHTML = '<option value="">Select Scene</option>';
        document.getElementById('shot').innerHTML = '<option value="">Select Shot</option>';
    }

    clearShots() {
        document.getElementById('shot').innerHTML = '<option value="">Select Shot</option>';
    }

    setupEventListeners() {
        document.getElementById('submissionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitEntry();
        });

        document.getElementById('showAll').addEventListener('click', () => {
            this.renderTable();
            document.getElementById('weekFilter').value = '';
        });

        document.getElementById('prevWeek').addEventListener('click', () => {
            this.navigateWeek('prev'); // Go to older week
        });

        document.getElementById('nextWeek').addEventListener('click', () => {
            this.navigateWeek('next'); // Go to newer week
        });

        document.getElementById('weekFilter').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.filterByWeek();
            }
        });

        document.getElementById('applyFilters').addEventListener('click', () => {
            this.applyAdditionalFilters();
        });

        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearAllFilters();
        });

        document.getElementById('saveEdit').addEventListener('click', () => {
            this.saveEdit();
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.hideEditModal();
        });
    }

    async submitEntry() {
        const formData = {
            'Animator': document.getElementById('animator').value,
            'Project Type': document.getElementById('projectType').value,
            'Episode/Title': document.getElementById('episode').value,
            'Scene': document.getElementById('scene').value,
            'Shot': document.getElementById('shot').value,
            'Week (YYYYMMDD)': document.getElementById('week').value,
            'Status': document.getElementById('status').value,
            'Notes': document.getElementById('notes').value
        };

        try {
            // SCENARIO 2: Submit to Railway first
            const response = await fetch('/api/production-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const result = await response.json();
                
                // Update UI first
                await this.loadProductionData();
                
                // Re-apply current filter if one is active
                const currentFilter = document.getElementById('weekFilter').value;
                if (currentFilter) {
                    this.filterByWeek();
                } else {
                    this.renderTable();
                }
                
                document.getElementById('submissionForm').reset();
                this.clearSceneShot();
                
                // SCENARIO 2: Now sync to local server
                await this.syncToLocalServer(formData, 'create');
                
                alert(result.message || 'Entry submitted successfully!');
            } else {
                const error = await response.json();
                
                // Handle duplicate error specifically
                if (response.status === 400 && error.error === 'Duplicate scene/shot combination detected') {
                    const existing = error.existingEntry;
                    const message = `⚠️ DUPLICATE DETECTED\n\n` +
                        `This scene/shot combination already exists:\n\n` +
                        `${error.conflictDetails}\n\n` +
                        `Currently assigned to: ${existing.animator}\n` +
                        `Week: ${existing.week}\n` +
                        `Status: ${existing.status}\n\n` +
                        `Each scene/shot can only be assigned to one animator. ` +
                        `Please choose a different scene/shot combination.`;
                    
                    alert(message);
                } else {
                    alert(error.error || error.message || 'Error submitting entry');
                }
            }
        } catch (error) {
            console.error('Error submitting entry:', error);
            alert('Error submitting entry');
        }
    }

    renderTable() {
        const tbody = document.querySelector('#productionTable tbody');
        tbody.innerHTML = '';

        this.productionData.forEach((item, index) => {
            const row = document.createElement('tr');
            
            const statusClass = item.Status ? `status-${item.Status.toLowerCase().replace(' ', '-')}` : '';
            
            row.innerHTML = `
                <td>${item.Animator || ''}</td>
                <td>${item['Project Type'] || ''}</td>
                <td>${item['Episode/Title'] || ''}</td>
                <td>${item.Scene || ''}</td>
                <td>${item.Shot || ''}</td>
                <td>${item['Week (YYYYMMDD)'] || ''}</td>
                <td class="${statusClass}">${item.Status || ''}</td>
                <td>${item.Notes || ''}</td>
                <td>
                    <button class="btn-edit" onclick="tracker.showEditModal(${index})">Edit</button>
                    <button class="btn-delete" onclick="tracker.confirmDelete(${index})">×</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async filterByWeek() {
        const week = document.getElementById('weekFilter').value;
        if (!week || week.length !== 8) {
            alert('Please enter a valid week in YYYYMMDD format');
            return;
        }

        // Filter the current production data locally by the selected week
        const filteredData = this.productionData.filter(item => {
            return item['Week (YYYYMMDD)'] === week;
        });

        // Clear and render filtered table
        const tbody = document.querySelector('#productionTable tbody');
        tbody.innerHTML = '';

        if (filteredData.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="9" style="text-align: center;">No entries found for this week</td>';
            tbody.appendChild(row);
        } else {
            filteredData.forEach((item, originalIndex) => {
                // Find the original index in productionData for edit/delete operations
                const realIndex = this.productionData.findIndex(dataItem => 
                    dataItem.Animator === item.Animator &&
                    dataItem['Project Type'] === item['Project Type'] &&
                    dataItem['Episode/Title'] === item['Episode/Title'] &&
                    dataItem.Scene === item.Scene &&
                    dataItem.Shot === item.Shot &&
                    dataItem['Week (YYYYMMDD)'] === item['Week (YYYYMMDD)']
                );

                const row = document.createElement('tr');
                const statusClass = item.Status ? `status-${item.Status.toLowerCase().replace(' ', '-')}` : '';
                
                row.innerHTML = `
                    <td>${item.Animator || ''}</td>
                    <td>${item['Project Type'] || ''}</td>
                    <td>${item['Episode/Title'] || ''}</td>
                    <td>${item.Scene || ''}</td>
                    <td>${item.Shot || ''}</td>
                    <td>${item['Week (YYYYMMDD)'] || ''}</td>
                    <td class="${statusClass}">${item.Status || ''}</td>
                    <td>${item.Notes || ''}</td>
                    <td>
                        <button class="btn-edit" onclick="tracker.showEditModal(${realIndex})">Edit</button>
                        <button class="btn-delete" onclick="tracker.confirmDelete(${realIndex})">×</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        console.log(`📅 Filtered by week ${week}: ${filteredData.length} entries found`);
    }

    applyAdditionalFilters() {
        const animatorFilter = document.getElementById('animatorFilter').value;
        const episodeFilter = document.getElementById('episodeFilter').value;
        const notesFilter = document.getElementById('notesFilter').value.toLowerCase().trim();

        let filteredData = [...this.productionData];

        // Apply animator filter
        if (animatorFilter) {
            filteredData = filteredData.filter(item => item.Animator === animatorFilter);
        }

        // Apply episode filter
        if (episodeFilter) {
            filteredData = filteredData.filter(item => item['Episode/Title'] === episodeFilter);
        }

        // Apply notes filter (case-insensitive partial match)
        if (notesFilter) {
            filteredData = filteredData.filter(item => 
                item.Notes && item.Notes.toLowerCase().includes(notesFilter)
            );
        }

        // Clear and render filtered table
        const filterDescription = this.buildFilterDescription(animatorFilter, episodeFilter, notesFilter);
        this.renderFilteredData(filteredData, filterDescription);
    }

    buildFilterDescription(animatorFilter, episodeFilter, notesFilter) {
        const filters = [];
        if (animatorFilter) filters.push(`animator: ${animatorFilter}`);
        if (episodeFilter) filters.push(`episode: ${episodeFilter}`);
        if (notesFilter) filters.push(`notes: "${notesFilter}"`);
        return filters.length > 0 ? filters.join(', ') : 'multiple filters';
    }

    clearAllFilters() {
        // Clear all filter dropdowns
        document.getElementById('animatorFilter').value = '';
        document.getElementById('episodeFilter').value = '';
        document.getElementById('notesFilter').value = '';
        document.getElementById('weekFilter').value = '';
        
        // Show all data
        this.renderTable();
        
        console.log('🧹 All filters cleared - showing all data');
    }

    renderFilteredData(filteredData, filterDescription) {
        const tbody = document.querySelector('#productionTable tbody');
        tbody.innerHTML = '';

        if (filteredData.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="9" style="text-align: center;">No entries found for selected filters</td>';
            tbody.appendChild(row);
        } else {
            filteredData.forEach((item, originalIndex) => {
                // Find the original index in productionData for edit/delete operations
                const realIndex = this.productionData.findIndex(dataItem => 
                    dataItem.Animator === item.Animator &&
                    dataItem['Project Type'] === item['Project Type'] &&
                    dataItem['Episode/Title'] === item['Episode/Title'] &&
                    dataItem.Scene === item.Scene &&
                    dataItem.Shot === item.Shot &&
                    dataItem['Week (YYYYMMDD)'] === item['Week (YYYYMMDD)']
                );

                const row = document.createElement('tr');
                const statusClass = item.Status ? `status-${item.Status.toLowerCase().replace(' ', '-')}` : '';
                
                row.innerHTML = `
                    <td>${item.Animator || ''}</td>
                    <td>${item['Project Type'] || ''}</td>
                    <td>${item['Episode/Title'] || ''}</td>
                    <td>${item.Scene || ''}</td>
                    <td>${item.Shot || ''}</td>
                    <td>${item['Week (YYYYMMDD)'] || ''}</td>
                    <td class="${statusClass}">${item.Status || ''}</td>
                    <td>${item.Notes || ''}</td>
                    <td>
                        <button class="btn-edit" onclick="tracker.showEditModal(${realIndex})">Edit</button>
                        <button class="btn-delete" onclick="tracker.confirmDelete(${realIndex})">×</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        console.log(`🔍 Filtered by ${filterDescription}: ${filteredData.length} entries found`);
    }

    populateEpisodeFilterDropdown() {
        const episodeFilter = document.getElementById('episodeFilter');
        
        // Get unique episodes from current production data
        const uniqueEpisodes = [...new Set(this.productionData.map(item => item['Episode/Title']).filter(Boolean))];
        uniqueEpisodes.sort();

        // Clear existing options except "All Episodes/Titles"
        episodeFilter.innerHTML = '<option value="">All Episodes/Titles</option>';

        uniqueEpisodes.forEach(episode => {
            const option = document.createElement('option');
            option.value = episode;
            option.textContent = episode;
            episodeFilter.appendChild(option);
        });

        console.log(`📺 Populated episode filter with ${uniqueEpisodes.length} unique episodes`);
    }

    showEditModal(index) {
        this.currentEditIndex = index;
        const item = this.productionData[index];
        
        const editForm = document.getElementById('editForm');
        editForm.innerHTML = `
            <div class="form-group">
                <label for="editAnimator">Animator:</label>
                <select id="editAnimator" required>
                    <optgroup label="Staff Animators">
                        <option value="Abhishek A." ${item.Animator === 'Abhishek A.' ? 'selected' : ''}>Abhishek A.</option>
                        <option value="Kiran Kilaga" ${item.Animator === 'Kiran Kilaga' ? 'selected' : ''}>Kiran Kilaga</option>
                        <option value="Saumitra Sachan" ${item.Animator === 'Saumitra Sachan' ? 'selected' : ''}>Saumitra Sachan</option>
                        <option value="Pranab Rout" ${item.Animator === 'Pranab Rout' ? 'selected' : ''}>Pranab Rout</option>
                        <option value="Nazir Hossain" ${item.Animator === 'Nazir Hossain' ? 'selected' : ''}>Nazir Hossain</option>
                        <option value="Nikhil Prakash" ${item.Animator === 'Nikhil Prakash' ? 'selected' : ''}>Nikhil Prakash</option>
                    </optgroup>
                    <optgroup label="Freelance Animators">
                        <option value="Malhar Parode" ${item.Animator === 'Malhar Parode' ? 'selected' : ''}>Malhar Parode</option>
                    </optgroup>
                </select>
            </div>
            <div class="form-group">
                <label for="editWeek">Week (YYYYMMDD):</label>
                <input type="text" id="editWeek" value="${item['Week (YYYYMMDD)'] || ''}" pattern="[0-9]{8}">
            </div>
            <div class="form-group">
                <label for="editStatus">Status:</label>
                <select id="editStatus" required>
                    <option value="submit-review-jae" ${item.Status === 'submit-review-jae' ? 'selected' : ''}>Submit review from Jae</option>
                    <option value="approved-jae" ${item.Status === 'approved-jae' ? 'selected' : ''}>Approved by Jae</option>
                    <option value="needs-revision" ${item.Status === 'needs-revision' ? 'selected' : ''}>Needs Revision</option>
                </select>
            </div>
            <div class="form-group">
                <label for="editNotes">Notes:</label>
                <textarea id="editNotes" rows="3">${item.Notes || ''}</textarea>
            </div>
        `;

        document.getElementById('editModal').style.display = 'block';
    }

    hideEditModal() {
        document.getElementById('editModal').style.display = 'none';
        this.currentEditIndex = -1;
    }

    async saveEdit() {
        if (this.currentEditIndex === -1) return;

        const updatedItem = {
            ...this.productionData[this.currentEditIndex],
            'Animator': document.getElementById('editAnimator').value,
            'Week (YYYYMMDD)': document.getElementById('editWeek').value,
            'Status': document.getElementById('editStatus').value,
            'Notes': document.getElementById('editNotes').value
        };

        try {
            const response = await fetch(`/api/production-data/${this.currentEditIndex}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedItem)
            });

            if (response.ok) {
                await this.loadProductionData();
                
                // Re-apply current filter if one is active
                const currentFilter = document.getElementById('weekFilter').value;
                if (currentFilter) {
                    this.filterByWeek();
                } else {
                    this.renderTable();
                }
                
                this.hideEditModal();
                
                // SCENARIO 2: Sync update to local server
                await this.syncToLocalServer(updatedItem, 'update');
                
                alert('Entry updated successfully!');
            } else {
                alert('Error updating entry');
            }
        } catch (error) {
            console.error('Error updating entry:', error);
            alert('Error updating entry');
        }
    }

    navigateWeek(direction) {
        let currentWeek = document.getElementById('weekFilter').value;
        
        if (!currentWeek || currentWeek.length !== 8) {
            // If no week is set, use latest week
            currentWeek = this.latestWeek || this.formatDateToYYYYMMDD(this.getMondayOfWeek(new Date()));
        }
        
        const currentDate = this.parseYYYYMMDD(currentWeek);
        const newDate = new Date(currentDate);
        
        if (direction === 'prev') {
            // Previous = older week (subtract 7 days)
            newDate.setDate(currentDate.getDate() - 7);
        } else if (direction === 'next') {
            // Next = newer week (add 7 days)
            newDate.setDate(currentDate.getDate() + 7);
        }
        
        const newWeek = this.formatDateToYYYYMMDD(newDate);
        
        // Don't go to future weeks beyond current week
        if (direction === 'next' && newWeek > this.latestWeek) {
            return; // Don't navigate to future
        }
        
        document.getElementById('weekFilter').value = newWeek;
        this.filterByWeek();
        this.updateNavigationButtons();
    }

    updateNavigationButtons() {
        const currentWeek = document.getElementById('weekFilter').value;
        const nextButton = document.getElementById('nextWeek');
        const prevButton = document.getElementById('prevWeek');
        
        // Disable next button if on current/latest week (can't go to future)
        if (currentWeek === this.latestWeek) {
            nextButton.disabled = true;
            nextButton.style.opacity = '0.5';
            nextButton.style.cursor = 'not-allowed';
        } else {
            nextButton.disabled = false;
            nextButton.style.opacity = '1';
            nextButton.style.cursor = 'pointer';
        }
        
        // Always enable prev button (can always go to older weeks)
        prevButton.disabled = false;
        prevButton.style.opacity = '1';
        prevButton.style.cursor = 'pointer';
    }

    confirmDelete(index) {
        const item = this.productionData[index];
        const confirmMessage = `Are you sure you want to delete this entry?\n\n` +
            `Animator: ${item.Animator}\n` +
            `Project: ${item['Episode/Title']}\n` +
            `Scene: ${item.Scene}, Shot: ${item.Shot}\n` +
            `Week: ${item['Week (YYYYMMDD)']}\n\n` +
            `This action is irreversible!`;
        
        if (confirm(confirmMessage)) {
            this.deleteEntry(index);
        }
    }

    async deleteEntry(index) {
        try {
            const response = await fetch(`/api/production-data/${index}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadProductionData();
                
                // Re-apply current filter if one is active
                const currentFilter = document.getElementById('weekFilter').value;
                if (currentFilter) {
                    await this.filterByWeek();
                } else {
                    this.renderTable();
                }
                
                // SCENARIO 2: Sync deletion to local server
                await this.syncToLocalServer({ index }, 'delete');
                
                alert('Entry deleted successfully!');
            } else {
                alert('Error deleting entry');
            }
        } catch (error) {
            console.error('Error deleting entry:', error);
            alert('Error deleting entry');
        }
    }

    getMondayOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        return new Date(d.setDate(diff));
    }

    formatDateToYYYYMMDD(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    parseYYYYMMDD(dateString) {
        if (dateString.length !== 8) return new Date();
        const year = parseInt(dateString.substring(0, 4));
        const month = parseInt(dateString.substring(4, 6)) - 1; // Month is 0-indexed
        const day = parseInt(dateString.substring(6, 8));
        return new Date(year, month, day);
    }
}

const tracker = new ProductionTracker();