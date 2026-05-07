# Project Documentation: MySimkari Sync

## Project Overview
**Project Name**: MySimkari Sync Application
**Objective**: To automate the performance reporting process for employees by extracting data from local documents and synchronizing it with the MySimkari portal.

## Scope of Work
- [x] File System integration (Tree view navigation)
- [x] Multi-format document parsing (PDF, DOCX, XLSX, PPTX)
- [x] Automated data extraction (Activity name, desc, date)
- [x] SQLite integration for local data persistence
- [x] Web session management & manual login capture
- [x] MySimkari Form synchronization (HTTP POST automation)
- [x] Office-to-PDF conversion tools

## Technology Stack
- **Framework**: Electron
- **Frontend**: Vue.js 3, TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite (via `better-sqlite3`)
- **Build Tool**: Vite
- **Libraries**: `pdf-parse`, `mammoth`, `xlsx`, `officeparser`, `cheerio`

## Key Stakeholders
- **Users**: Employees of Kejaksaan RI.
- **Goal**: Reduce manual data entry time and minimize errors in performance reporting.

## Current Project Status
- **UI/UX**: Completed (following design references in `./design`).
- **Core Logic**: File reading, parsing, and SQLite storage are implemented.
- **Sync Module**: Implementation for session capture and multipart upload is ready.
- **OS Integration**: Windows-specific features (Office COM) implemented.

## Roadmap / Future Enhancements
- [ ] Improved AI-based parsing for more accurate data extraction.
- [ ] Support for more document types.
- [ ] Batch synchronization feature.
- [ ] Offline mode with delayed sync.
