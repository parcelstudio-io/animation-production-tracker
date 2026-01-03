const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

class DurationService {
    constructor() {
        // Base path to THE BREAKFAST FAM project (from server/services/ to THE BREAKFAST FAM root)
        this.basePath = path.resolve(__dirname, '../../../..');
        
        // Long-form paths (episodes) - these are base paths, subdirectories will be added dynamically
        this.longFormBasePaths = [
            'Episode_06',                                   // Current episode
            'Episode_05 - Surviving Trip to SF',           // Episode 5
        ];
        
        // Short-form path
        this.shortFormPath = 'contents/short_forms';
    }

    async checkAnimationDurations(records) {
        console.log('🎬 Starting animation duration checking...');
        const results = [];
        
        for (const record of records) {
            try {
                const durationInfo = await this.getDurationForRecord(record);
                results.push({
                    ...record,
                    duration_info: durationInfo
                });
            } catch (error) {
                console.error(`❌ Error checking duration for record ${record.id}:`, error.message);
                results.push({
                    ...record,
                    duration_info: {
                        error: error.message,
                        status: 'failed'
                    }
                });
            }
        }
        
        console.log(`✅ Duration checking completed for ${results.length} records`);
        return results;
    }

    async getDurationForRecord(record) {
        const projectType = record.project_type || record['Project Type'];
        const episodeTitle = record.episode_title || record['Episode/Title'];
        const scene = record.scene || record.Scene;
        const shot = record.shot || record.Shot;
        
        console.log(`🔍 Checking duration for ${projectType}: ${episodeTitle}, Scene: ${scene}, Shot: ${shot}`);
        
        if (projectType === 'long-form') {
            return await this.getLongFormDuration(episodeTitle, scene, shot);
        } else if (projectType === 'short-form') {
            return await this.getShortFormDuration(episodeTitle, scene, shot);
        } else {
            throw new Error(`Unknown project type: ${projectType}`);
        }
    }

    async getLongFormDuration(episodeTitle, scene, shot) {
        const possiblePaths = [];
        
        // Extract episode number from title
        const episodeMatch = episodeTitle.match(/episode[_\s]?(\d+)/i);
        
        if (episodeMatch) {
            const episodeNum = episodeMatch[1].padStart(2, '0');
            const sceneFormatted = scene.toLowerCase().includes('sc_') ? scene : `sc_${scene.padStart(2, '0')}`;
            const shotFormatted = shot.toLowerCase().includes('sh_') ? shot : `sh_${shot.padStart(2, '0')}`;
            
            // Pattern 1: Episode_XX/03_Production/Shots/sc_XX/sh_XX/Playblasts/animation/
            possiblePaths.push(
                path.join(this.basePath, `Episode_${episodeNum}`, '03_Production', 'Shots', sceneFormatted, shotFormatted, 'Playblasts', 'animation')
            );
            
            // Pattern 2: Episode_XX/For lineup/ (final playblasts)
            possiblePaths.push(
                path.join(this.basePath, `Episode_${episodeNum}`, 'For lineup')
            );
        }
        
        // Pattern 3: Episode_05 special naming (legacy)
        if (episodeTitle.toLowerCase().includes('episode_05') || episodeTitle.toLowerCase().includes('episode 5')) {
            possiblePaths.push(
                path.join(this.basePath, 'Episode_05 - Surviving Trip to SF', 'For lineup')
            );
        }
        
        console.log(`📁 Searching paths:`, possiblePaths.map(p => path.basename(p)));
        
        return await this.findAndAnalyzeVideoFiles(possiblePaths, scene, shot, 'long-form');
    }

    async getShortFormDuration(episodeTitle, scene, shot) {
        // Short-form pattern: contents/short_forms/XX_title/01_scan/SH_XX/
        const shortFormPath = path.join(this.basePath, this.shortFormPath);
        
        // Find the matching short-form directory
        if (!fs.existsSync(shortFormPath)) {
            throw new Error(`Short-form base path not found: ${shortFormPath}`);
        }
        
        const shortFormDirs = fs.readdirSync(shortFormPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        // Look for matching episode title in directory names
        const matchingDir = shortFormDirs.find(dir => 
            dir.toLowerCase().includes(episodeTitle.toLowerCase()) ||
            episodeTitle.toLowerCase().includes(dir.toLowerCase())
        );
        
        if (!matchingDir) {
            throw new Error(`No matching short-form directory found for: ${episodeTitle}`);
        }
        
        const scanPath = path.join(shortFormPath, matchingDir, '01_scan');
        
        if (!fs.existsSync(scanPath)) {
            throw new Error(`01_scan directory not found: ${scanPath}`);
        }
        
        return await this.analyzeImageSequence(scanPath, shot, 'short-form');
    }

    async findAndAnalyzeVideoFiles(possiblePaths, scene, shot, type) {
        for (const searchPath of possiblePaths) {
            if (!fs.existsSync(searchPath)) {
                continue;
            }
            
            try {
                const videoFiles = this.findVideoFiles(searchPath, scene, shot);
                if (videoFiles.length > 0) {
                    return await this.analyzeVideoFiles(videoFiles, type);
                }
            } catch (error) {
                console.warn(`⚠️ Error searching path ${searchPath}:`, error.message);
            }
        }
        
        throw new Error(`No video files found for scene ${scene}, shot ${shot} in any of the search paths`);
    }

    findVideoFiles(directory, scene, shot) {
        const videoFiles = [];
        
        const findFilesRecursively = (dir) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                
                if (item.isDirectory()) {
                    findFilesRecursively(fullPath);
                } else if (this.isVideoFile(item.name)) {
                    // Check if filename matches scene/shot pattern
                    const filename = item.name.toLowerCase();
                    const sceneLower = scene.toLowerCase();
                    const shotLower = shot.toLowerCase();
                    
                    const sceneMatch = filename.includes(sceneLower);
                    const shotMatch = filename.includes(shotLower);
                    
                    if (sceneMatch && shotMatch) {
                        videoFiles.push(fullPath);
                    }
                }
            }
        };
        
        findFilesRecursively(directory);
        return videoFiles;
    }

    async analyzeVideoFiles(videoFiles, type) {
        console.log(`📹 Analyzing ${videoFiles.length} video files for ${type}`);
        
        const fileAnalysis = [];
        
        for (const videoFile of videoFiles) {
            try {
                const duration = await this.getVideoDuration(videoFile);
                const stats = fs.statSync(videoFile);
                
                fileAnalysis.push({
                    filepath: videoFile,
                    filename: path.basename(videoFile),
                    duration_seconds: duration,
                    duration_frames: Math.round(duration * 24), // Assuming 24fps
                    filesize_mb: Math.round(stats.size / (1024 * 1024) * 100) / 100,
                    modified_date: stats.mtime
                });
                
                console.log(`  ✅ ${path.basename(videoFile)}: ${duration.toFixed(2)}s (${Math.round(duration * 24)} frames @ 24fps)`);
            } catch (error) {
                console.error(`  ❌ Failed to analyze ${path.basename(videoFile)}:`, error.message);
                fileAnalysis.push({
                    filepath: videoFile,
                    filename: path.basename(videoFile),
                    error: error.message
                });
            }
        }
        
        // Calculate totals
        const validFiles = fileAnalysis.filter(f => !f.error);
        const totalDuration = validFiles.reduce((sum, f) => sum + (f.duration_seconds || 0), 0);
        const totalFrames = validFiles.reduce((sum, f) => sum + (f.duration_frames || 0), 0);
        
        return {
            type: type,
            files_found: videoFiles.length,
            files_analyzed: validFiles.length,
            files_with_errors: fileAnalysis.length - validFiles.length,
            total_duration_seconds: totalDuration,
            total_duration_frames: totalFrames,
            total_duration_formatted: this.formatDuration(totalDuration),
            files: fileAnalysis,
            status: 'success'
        };
    }

    async analyzeImageSequence(scanPath, shot, type) {
        console.log(`🖼️ Analyzing image sequence in ${scanPath} for ${type}`);
        
        // Look for shot-specific subdirectory
        const shotDirs = fs.readdirSync(scanPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        const shotLower = shot.toLowerCase();
        const matchingDir = shotDirs.find(dir => {
            const dirLower = dir.toLowerCase();
            return dirLower.includes(shotLower) || shotLower.includes(dirLower);
        });
        
        if (!matchingDir) {
            throw new Error(`No matching shot directory found in ${scanPath}`);
        }
        
        const shotPath = path.join(scanPath, matchingDir);
        const imageFiles = fs.readdirSync(shotPath)
            .filter(file => this.isImageFile(file))
            .sort();
        
        if (imageFiles.length === 0) {
            throw new Error(`No image files found in ${shotPath}`);
        }
        
        // Calculate duration assuming 24fps
        const frameCount = imageFiles.length;
        const duration = frameCount / 24;
        
        console.log(`  ✅ Found ${frameCount} frames: ${duration.toFixed(2)}s @ 24fps`);
        
        return {
            type: type,
            scan_path: shotPath,
            frame_count: frameCount,
            duration_seconds: duration,
            duration_frames: frameCount,
            duration_formatted: this.formatDuration(duration),
            first_frame: imageFiles[0],
            last_frame: imageFiles[imageFiles.length - 1],
            status: 'success'
        };
    }

    async getVideoDuration(videoPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    reject(err);
                } else {
                    const duration = metadata.format.duration;
                    resolve(duration);
                }
            });
        });
    }

    isVideoFile(filename) {
        const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv'];
        return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    }

    isImageFile(filename) {
        const imageExtensions = ['.exr', '.png', '.jpg', '.jpeg', '.tif', '.tiff', '.dpx'];
        return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    }

    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toFixed(2).padStart(5, '0')}`;
    }
}

module.exports = new DurationService();