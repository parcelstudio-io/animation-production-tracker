# Animation Production Tracker

A clean, minimalist webapp for tracking animation production submissions and approvals.

## Features

- **Clean black and white interface** for professional appearance
- **Directory scanning** to automatically detect episodes, scenes, and shots
- **Dropdown menus** for easy selection of projects, episodes, scenes, shots, and animators
- **Weekly tracking** using YYYYMMDD format for Monday weeks
- **Excel integration** with automatic production_summary.xlsx creation and updates
- **Edit functionality** for updating submission status and approval dates
- **Weekly summary view** to see all work for specific weeks
- **Railway-Local synchronization** for real-time production tracking
- **Automatic duration checking** for animation playblasts and scans
- **FFmpeg integration** for video duration analysis

## Setup Instructions

1. **Install dependencies:**
   ```bash
   cd webapp
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **For development mode with auto-restart:**
   ```bash
   npm run dev
   ```

4. **Open your browser and navigate to:**
   ```
   http://localhost:3000
   ```

## Directory Structure

The webapp automatically scans and analyzes the following directory structures for playblast duration checking:

### Long-form Episodes (Animation Playblasts):
```
Episode_XX/03_Production/Shots/sc_XX/sh_XX/Playblasts/animation/
└── Contains: .mp4/.mov video files with duration analysis

Episode_XX/For lineup/
└── Contains: Final animation playblasts for review
```

### Short-form Content (Image Sequences):
```
contents/short_forms/XX_title/01_scan/SH_XX/
└── Contains: .exr/.png/.jpg image sequences
└── Duration calculated from frame count @ 24fps
```

### Production Structure:
```
Episode_XX/03_Production/Shots/sc_XX/sh_XX/
├── Export/
├── Playblasts/
│   └── animation/
│       ├── v001/
│       ├── v002/
│       └── ...
├── Renders/
└── Scenefiles/
```

## Excel File

The `production_summary.xlsx` file is automatically created with the following columns:
- Animator
- Project Type (long-form/short-form)
- Episode/Title
- Scene
- Shot
- Week Sent (YYYYMMDD)
- Week Approved (YYYYMMDD)
- Status
- Notes

## Duration Checking System

The system automatically analyzes animation durations when receiving updates from the Railway app:

### Long-form Animation:
- **Source:** `.mp4/.mov` files in `Playblasts/animation/` directories
- **Analysis:** FFmpeg duration extraction in seconds and frames
- **Output:** Total duration per scene/shot with frame counts @ 24fps

### Short-form Content:
- **Source:** Image sequences in `01_scan/` directories  
- **Analysis:** Frame count from `.exr/.png/.jpg` files
- **Output:** Duration calculated as frame_count / 24fps

### Duration Analysis Features:
- Automatic detection of latest playblast versions
- Frame-accurate duration calculations
- Error handling for missing files
- Comprehensive logging and reporting
- Integration with sync process for real-time updates

## Usage

1. **Submit new work:** Fill out the form with project details and submission date
2. **Update entries:** Click "Edit" on any table row to modify status or approval dates
3. **View weekly summaries:** Enter a week in YYYYMMDD format to filter by specific weeks
4. **Track status:** Entries are color-coded by status (submitted, approved, revision needed)
5. **Duration Analysis:** Automatically triggered when Railway sends updates to local server

## Animators

The system includes these animators by default:
- KK
- Abhi
- Hardik
- OMK
- SAK

## Tech Stack

- **Backend:** Node.js with Express
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Excel handling:** xlsx library
- **File system:** Native Node.js fs module for directory scanning