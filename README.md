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

The webapp expects the following directory structure from the root project folder:

### Long-form Episodes:
```
Episode_XX/03_Production/Shots/SC_XX/SH_XX/
```

### Short-form Content:
```
contents/short_forms/<title>/03_animation/<scene>/<shot>/
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

## Usage

1. **Submit new work:** Fill out the form with project details and submission date
2. **Update entries:** Click "Edit" on any table row to modify status or approval dates
3. **View weekly summaries:** Enter a week in YYYYMMDD format to filter by specific weeks
4. **Track status:** Entries are color-coded by status (submitted, approved, revision needed)

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