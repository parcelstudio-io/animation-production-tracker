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
            console.log('🔄 Loading page data from both Railway and local server...');
            
            // Load Railway data first
            await this.loadDirectoryStructure();
            await this.loadProductionData();
            
            // Then fetch updated data from local server
            await this.fetchFromLocalServer();
            
        } catch (error) {
            console.error('Error loading page data:', error);
        }
    }

    async fetchFromLocalServer() {
        try {
            console.log('📥 Fetching structure and production data from local server...');
            
            // Call the Railway endpoint that queries local server
            const response = await fetch('/api/production-data/with-local-sync');
            const result = await response.json();
            
            if (result.success && result.localServerConnected) {
                console.log('✅ Local server connected - updating data');
                
                // Update production data if local server provided it
                if (result.localServerData) {
                    console.log(`📊 Updated ${result.localServerData.length} production records from local server`);
                    this.mergeProductionData(result.localServerData);
                }
                
                // Update structure data if local server provided it
                if (result.localServerStructure && result.localServerStructure.structure) {
                    console.log('📁 Updating directory structure from local server');
                    this.directoryStructure = result.localServerStructure.structure;
                    this.populateProjectDropdown(); // Refresh dropdowns with new structure
                }
                
                // Show success indicator
                this.showLocalServerStatus(true, 'Connected to local server');
            } else {
                console.log('⚠️ Local server not available - using Railway data only');
                this.showLocalServerStatus(false, 'Local server not available');
            }
            
        } catch (error) {
            console.warn('❌ Failed to fetch from local server:', error);
            this.showLocalServerStatus(false, 'Local server connection failed');
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
        // Create or update status indicator
        let statusDiv = document.getElementById('local-server-status');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'local-server-status';
            statusDiv.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                color: white;
                z-index: 1000;
                transition: opacity 0.3s;
            `;
            document.body.appendChild(statusDiv);
        }
        
        statusDiv.textContent = `🖥️ ${message}`;
        statusDiv.style.backgroundColor = connected ? '#28a745' : '#dc3545';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            statusDiv.style.opacity = '0.7';
        }, 3000);
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

        if (projectType === 'long-form') {
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
            }
        } else if (projectType === 'short-form') {
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
            }
        }
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

        document.getElementById('filterWeek').addEventListener('click', () => {
            this.filterByWeek();
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
                this.renderTable();
                document.getElementById('submissionForm').reset();
                this.clearSceneShot();
                
                // SCENARIO 2: Now sync to local server
                await this.syncToLocalServer(formData, 'create');
                
                alert(result.message || 'Entry submitted successfully!');
            } else {
                const error = await response.json();
                alert(error.error || 'Error submitting entry');
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

        try {
            const response = await fetch(`/api/weekly-summary/${week}`);
            const weeklyData = await response.json();
            
            const tbody = document.querySelector('#productionTable tbody');
            tbody.innerHTML = '';

            weeklyData.forEach((item, index) => {
                const row = document.createElement('tr');
                const statusClass = item.Status ? `status-${item.Status.toLowerCase().replace(' ', '-')}` : '';
                
                row.innerHTML = `
                    <td>${item.Animator || ''}</td>
                    <td>${item['Project Type'] || ''}</td>
                    <td>${item['Episode/Title'] || ''}</td>
                    <td>${item.Scene || ''}</td>
                    <td>${item.Shot || ''}</td>
                    <td>${item['Week Sent (YYYYMMDD)'] || ''}</td>
                    <td>${item['Week Approved (YYYYMMDD)'] || ''}</td>
                    <td class="${statusClass}">${item.Status || ''}</td>
                    <td>${item.Notes || ''}</td>
                    <td>
                        <button class="btn-view" onclick="tracker.renderTable()">View All</button>
                    </td>
                `;
                tbody.appendChild(row);
            });

            if (weeklyData.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = '<td colspan="10" style="text-align: center;">No entries found for this week</td>';
                tbody.appendChild(row);
            }
        } catch (error) {
            console.error('Error filtering by week:', error);
            alert('Error loading weekly data');
        }
    }

    showEditModal(index) {
        this.currentEditIndex = index;
        const item = this.productionData[index];
        
        const editForm = document.getElementById('editForm');
        editForm.innerHTML = `
            <div class="form-group">
                <label for="editAnimator">Animator:</label>
                <select id="editAnimator" required>
                    <option value="Abhishek A." ${item.Animator === 'Abhishek A.' ? 'selected' : ''}>Abhishek A.</option>
                    <option value="Kiran Kilaga" ${item.Animator === 'Kiran Kilaga' ? 'selected' : ''}>Kiran Kilaga</option>
                    <option value="Saumitra Sachan" ${item.Animator === 'Saumitra Sachan' ? 'selected' : ''}>Saumitra Sachan</option>
                    <option value="Pranab Rout" ${item.Animator === 'Pranab Rout' ? 'selected' : ''}>Pranab Rout</option>
                    <option value="Nazir Hossain" ${item.Animator === 'Nazir Hossain' ? 'selected' : ''}>Nazir Hossain</option>
                    <option value="Nikhil Prakash" ${item.Animator === 'Nikhil Prakash' ? 'selected' : ''}>Nikhil Prakash</option>
                </select>
            </div>
            <div class="form-group">
                <label for="editWeek">Week (YYYYMMDD):</label>
                <input type="text" id="editWeek" value="${item['Week (YYYYMMDD)'] || ''}" pattern="[0-9]{8}">
            </div>
            <div class="form-group">
                <label for="editStatus">Status:</label>
                <select id="editStatus" required>
                    <option value="submitted" ${item.Status === 'submitted' ? 'selected' : ''}>Submitted for Review</option>
                    <option value="approved" ${item.Status === 'approved' ? 'selected' : ''}>Approved</option>
                    <option value="revision" ${item.Status === 'revision' ? 'selected' : ''}>Needs Revision</option>
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
                this.renderTable();
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