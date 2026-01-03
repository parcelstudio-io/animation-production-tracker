const fs = require('fs');
const path = require('path');

class DirectoryScanner {
    constructor() {
        // Base directory for episodes (3 levels up from production folder)
        this.baseDir = path.join(__dirname, '../../../..');
        this.shortFormsDir = path.join(this.baseDir, 'Short-Forms');
        this.episodesPattern = /^Episode_\d+/i;
        this.scenePattern = /^SC_\d+/i;
        this.shotPattern = /^SH_\d+/i;
    }

    /**
     * Scan the complete directory structure for episodes and short forms
     * @returns {Object} Structure containing episodes and shortForms with scenes and shots
     */
    scanDirectoryStructure() {
        try {
            console.log('📁 Scanning directory structure...');
            console.log(`📍 Base directory: ${this.baseDir}`);

            const structure = {
                episodes: this.scanEpisodes(),
                shortForms: this.scanShortForms(),
                lastScanned: new Date().toISOString()
            };

            console.log(`✅ Directory scan complete:`);
            console.log(`  - Episodes: ${structure.episodes.length}`);
            console.log(`  - Short Forms: ${structure.shortForms.length}`);

            return structure;
        } catch (error) {
            console.error('❌ Error scanning directory structure:', error);
            return {
                episodes: [],
                shortForms: [],
                lastScanned: new Date().toISOString(),
                error: error.message
            };
        }
    }

    /**
     * Scan for episodes in the base directory
     * @returns {Array} Array of episode objects with scenes and shots
     */
    scanEpisodes() {
        try {
            if (!fs.existsSync(this.baseDir)) {
                console.warn(`⚠️ Episodes directory not found: ${this.baseDir}`);
                return [];
            }

            const items = fs.readdirSync(this.baseDir, { withFileTypes: true });
            const episodes = [];

            for (const item of items) {
                if (item.isDirectory() && this.episodesPattern.test(item.name)) {
                    const episodePath = path.join(this.baseDir, item.name);
                    const episodeData = this.scanEpisodeDirectory(item.name, episodePath);
                    episodes.push(episodeData);
                }
            }

            // Sort episodes naturally (Episode_01, Episode_02, etc.)
            episodes.sort((a, b) => {
                const aNum = parseInt(a.name.match(/\d+/)?.[0] || '0');
                const bNum = parseInt(b.name.match(/\d+/)?.[0] || '0');
                return aNum - bNum;
            });

            console.log(`📺 Found ${episodes.length} episodes`);
            return episodes;
        } catch (error) {
            console.error('❌ Error scanning episodes:', error);
            return [];
        }
    }

    /**
     * Scan for short forms (if directory exists)
     * @returns {Array} Array of short form objects with scenes and shots
     */
    scanShortForms() {
        try {
            if (!fs.existsSync(this.shortFormsDir)) {
                console.log(`📝 Short Forms directory not found: ${this.shortFormsDir}`);
                return [];
            }

            const items = fs.readdirSync(this.shortFormsDir, { withFileTypes: true });
            const shortForms = [];

            for (const item of items) {
                if (item.isDirectory()) {
                    const shortFormPath = path.join(this.shortFormsDir, item.name);
                    const shortFormData = this.scanShortFormDirectory(item.name, shortFormPath);
                    shortForms.push(shortFormData);
                }
            }

            console.log(`🎬 Found ${shortForms.length} short forms`);
            return shortForms;
        } catch (error) {
            console.error('❌ Error scanning short forms:', error);
            return [];
        }
    }

    /**
     * Scan individual episode directory for scenes and shots
     * @param {string} episodeName - Name of the episode
     * @param {string} episodePath - Full path to episode directory
     * @returns {Object} Episode object with scenes and shots
     */
    scanEpisodeDirectory(episodeName, episodePath) {
        const episode = {
            name: episodeName,
            path: episodePath,
            scenes: [],
            shots: []
        };

        try {
            // Look for Audio directory which contains scene/shot structure
            const audioPath = path.join(episodePath, 'Audio');
            if (fs.existsSync(audioPath)) {
                const audioFiles = fs.readdirSync(audioPath);
                const sceneShots = this.extractScenesAndShotsFromAudio(audioFiles);
                episode.scenes = sceneShots.scenes;
                episode.shots = sceneShots.shots;
            }

            // Also check Animation directory or other production directories
            const animationPaths = [
                path.join(episodePath, 'For lineup'),
                path.join(episodePath, 'Production'),
                path.join(episodePath, '03_Production')
            ];

            for (const animPath of animationPaths) {
                if (fs.existsSync(animPath)) {
                    const animFiles = fs.readdirSync(animPath);
                    const animSceneShots = this.extractScenesAndShotsFromAnimFiles(animFiles);
                    
                    // Merge with existing scenes/shots
                    episode.scenes = [...new Set([...episode.scenes, ...animSceneShots.scenes])].sort();
                    episode.shots = this.mergeShots(episode.shots, animSceneShots.shots);
                }
            }

            console.log(`📁 ${episodeName}: ${episode.scenes.length} scenes, ${episode.shots.length} shots`);
        } catch (error) {
            console.error(`❌ Error scanning episode ${episodeName}:`, error);
        }

        return episode;
    }

    /**
     * Scan individual short form directory
     * @param {string} shortFormName - Name of the short form
     * @param {string} shortFormPath - Full path to short form directory
     * @returns {Object} Short form object with scenes and shots
     */
    scanShortFormDirectory(shortFormName, shortFormPath) {
        const shortForm = {
            name: shortFormName,
            path: shortFormPath,
            scenes: [],
            shots: []
        };

        try {
            // Similar logic to episodes but for short forms
            const items = fs.readdirSync(shortFormPath, { withFileTypes: true });
            
            for (const item of items) {
                if (item.isDirectory()) {
                    const subPath = path.join(shortFormPath, item.name);
                    if (fs.existsSync(subPath)) {
                        const files = fs.readdirSync(subPath);
                        const sceneShots = this.extractScenesAndShotsFromAnimFiles(files);
                        
                        shortForm.scenes = [...new Set([...shortForm.scenes, ...sceneShots.scenes])].sort();
                        shortForm.shots = this.mergeShots(shortForm.shots, sceneShots.shots);
                    }
                }
            }

            console.log(`🎬 ${shortFormName}: ${shortForm.scenes.length} scenes, ${shortForm.shots.length} shots`);
        } catch (error) {
            console.error(`❌ Error scanning short form ${shortFormName}:`, error);
        }

        return shortForm;
    }

    /**
     * Extract scenes and shots from audio file names
     * @param {Array} audioFiles - Array of audio file names
     * @returns {Object} Object with scenes and shots arrays
     */
    extractScenesAndShotsFromAudio(audioFiles) {
        const scenes = new Set();
        const shots = [];

        for (const fileName of audioFiles) {
            // Pattern: SC_00_SH_01_Audio.wav
            const match = fileName.match(/^SC_(\d+)_SH_(\d+)_/);
            if (match) {
                const sceneNum = match[1];
                const shotNum = match[2];
                const sceneName = `SC_${sceneNum}`;
                const shotName = `SH_${shotNum}`;
                
                scenes.add(sceneName);
                shots.push({
                    scene: sceneName,
                    shot: shotName,
                    source: 'audio'
                });
            }
        }

        return {
            scenes: Array.from(scenes).sort(),
            shots: shots
        };
    }

    /**
     * Extract scenes and shots from animation file names
     * @param {Array} animFiles - Array of animation file names
     * @returns {Object} Object with scenes and shots arrays
     */
    extractScenesAndShotsFromAnimFiles(animFiles) {
        const scenes = new Set();
        const shots = [];

        for (const fileName of animFiles) {
            // Pattern: SC_00_SH_01_animation_v011.mp4
            const match = fileName.match(/^SC_(\d+)_SH_(\d+)_/);
            if (match) {
                const sceneNum = match[1];
                const shotNum = match[2];
                const sceneName = `SC_${sceneNum}`;
                const shotName = `SH_${shotNum}`;
                
                scenes.add(sceneName);
                shots.push({
                    scene: sceneName,
                    shot: shotName,
                    source: 'animation'
                });
            }
        }

        return {
            scenes: Array.from(scenes).sort(),
            shots: shots
        };
    }

    /**
     * Merge shot arrays, avoiding duplicates
     * @param {Array} existing - Existing shots array
     * @param {Array} newShots - New shots to merge
     * @returns {Array} Merged shots array
     */
    mergeShots(existing, newShots) {
        const shotMap = new Map();
        
        // Add existing shots
        for (const shot of existing) {
            const key = `${shot.scene}-${shot.shot}`;
            shotMap.set(key, shot);
        }
        
        // Add new shots (will overwrite if same key)
        for (const shot of newShots) {
            const key = `${shot.scene}-${shot.shot}`;
            shotMap.set(key, shot);
        }
        
        return Array.from(shotMap.values()).sort((a, b) => {
            if (a.scene !== b.scene) {
                return a.scene.localeCompare(b.scene);
            }
            return a.shot.localeCompare(b.shot);
        });
    }

    /**
     * Get simplified lists for dropdown population
     * @returns {Object} Object with episodes and shortForms arrays
     */
    getEpisodesList() {
        const structure = this.scanDirectoryStructure();
        
        return {
            episodes: structure.episodes.map(ep => ({
                name: ep.name,
                scenes: ep.scenes
            })),
            shortForms: structure.shortForms.map(sf => ({
                name: sf.name,
                scenes: sf.scenes
            }))
        };
    }

    /**
     * Get scenes for a specific project (episode or short form)
     * @param {string} projectName - Name of the project
     * @returns {Array} Array of scene names
     */
    getScenesForProject(projectName) {
        const structure = this.scanDirectoryStructure();
        
        // Check episodes first
        const episode = structure.episodes.find(ep => ep.name === projectName);
        if (episode) {
            return episode.scenes;
        }
        
        // Check short forms
        const shortForm = structure.shortForms.find(sf => sf.name === projectName);
        if (shortForm) {
            return shortForm.scenes;
        }
        
        console.warn(`⚠️ Project not found: ${projectName}`);
        return [];
    }

    /**
     * Get shots for a specific scene in a project
     * @param {string} projectName - Name of the project
     * @param {string} sceneName - Name of the scene
     * @returns {Array} Array of shot names
     */
    getShotsForScene(projectName, sceneName) {
        const structure = this.scanDirectoryStructure();
        
        // Check episodes first
        const episode = structure.episodes.find(ep => ep.name === projectName);
        if (episode) {
            return episode.shots
                .filter(shot => shot.scene === sceneName)
                .map(shot => shot.shot)
                .sort();
        }
        
        // Check short forms
        const shortForm = structure.shortForms.find(sf => sf.name === projectName);
        if (shortForm) {
            return shortForm.shots
                .filter(shot => shot.scene === sceneName)
                .map(shot => shot.shot)
                .sort();
        }
        
        console.warn(`⚠️ Project not found: ${projectName}`);
        return [];
    }
}

module.exports = new DirectoryScanner();