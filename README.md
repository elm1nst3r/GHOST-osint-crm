# OSINT Investigation CRM

## Project Description

The OSINT Investigation CRM is a web-based tool designed to help Open Source Intelligence (OSINT) investigators, researchers, and analysts manage their investigations, track individuals (Persons of Interest, clients, etc.), log relevant OSINT data, and manage a directory of useful OSINT tools. The application features a persistent database, relationship visualization capabilities (under development), and mapping of geolocations.

This tool aims to provide a centralized platform for organizing complex OSINT investigations, visualizing connections, and maintaining a curated list of external resources.

## Current Functionality (Version 0.9.0 - as of latest frontend code)

* **Dashboard:**
    * Overview cards for the number of registered OSINT Tools, active investigations (People), and open To-Do tasks.
    * Lists the "Recent Active People/Cases" with quick links to their details.
    * Interactive "To-Do List" widget for managing tasks (add, edit, mark as done, delete).
    * Placeholder for a "Global Relationship Overview" chart (React Flow integration in progress).
* **People Management:**
    * Add, view, edit, and delete person profiles.
    * Fields include: Name, Aliases, Date of Birth, Category (e.g., Person of Interest, Client), Status (e.g., Open, Being Investigated), CRM Status, Case Name, Profile Picture URL, Notes.
    * Ability to add multiple OSINT data points per person (e.g., social media, email, phone, location with coordinates, usernames).
    * Ability to add connections between people (rudimentary, to be visualized).
    * Search and filter people by name, alias, case, category, and status.
    * Detail view for each person showing all their information.
    * **Location Mapping (Leaflet):** In the person detail view, locations with valid coordinates are plotted on an interactive map.
    * **Relationship Chart (React Flow - Person Specific):** In the person detail view, a chart visualizes the selected person, their OSINT data points, and direct connections to other people.
* **OSINT Tools Directory:**
    * Add, view, edit, and delete OSINT tools.
    * Fields include: Name, Link, Description, Category, Status, Tags, Notes.
    * Search tools by name, category, or tag.
    * Tools displayed in a card layout with a direct link to visit the tool.
* **Settings Page:**
    * **General Configuration:**
        * Change the application name displayed in the sidebar.
        * Upload a custom application logo (PNG, JPG, GIF, SVG).
    * Placeholders for:
        * Data Model Customization (categories, statuses).
        * Data Import/Export.
        * Audit Log display.
* **Backend & Database:**
    * Node.js/Express.js backend server.
    * PostgreSQL database for persistent storage of People, Tools, and To-Dos.
    * API endpoints for CRUD operations on People, Tools, and To-Dos.
    * API endpoint for logo uploads.
    * Automatic database table creation on backend startup if tables don't exist.
* **Dockerized Deployment:**
    * Uses Docker Compose to manage multi-container application (frontend, backend, database).
    * Frontend served by Nginx.

## File Tree Structure

osint-crm/├── backend/│   ├── public/│   │   └── uploads/│   │       └── logos/        # Uploaded logos will be stored here│   ├── Dockerfile            # Docker configuration for the backend│   ├── package-lock.json│   ├── package.json          # Backend dependencies (Express, pg, multer, cors)│   └── server.js             # Main backend application logic├── frontend/│   ├── public/│   │   ├── index.html│   │   ├── favicon.ico│   │   ├── logo192.png│   │   ├── logo512.png│   │   └── manifest.json│   ├── src/│   │   ├── App.js            # Main React application component│   │   ├── index.css         # Global styles and Tailwind directives│   │   └── index.js          # React entry point│   ├── Dockerfile            # Docker configuration for the frontend (React + Nginx)│   ├── package-lock.json│   ├── package.json          # Frontend dependencies (React, Tailwind, Leaflet, React Flow, etc.)│   ├── postcss.config.js     # PostCSS configuration│   └── tailwind.config.js    # Tailwind CSS configuration├── .env                      # Optional: For storing environment variables (e.g., DB credentials)└── docker-compose.yml        # Docker Compose configuration for all services
## Setup Instructions (From Scratch)

These instructions assume you have **Node.js (which includes npm)** and **Docker (with Docker Compose)** installed on your system.

1.  **Clone/Create Project Directory:**
    Create a root directory for your project, e.g., `osint-crm`.
    ```bash
    mkdir osint-crm
    cd osint-crm
    ```

2.  **Create Frontend Structure & Files:**
    * Create a `frontend` subdirectory: `mkdir frontend`
    * Inside `frontend`, initialize a new React application (if you don't have one already):
        ```bash
        npx create-react-app .
        ```
        (The `.` installs it in the current `frontend` directory).
    * Install frontend dependencies (navigate into `frontend` first):
        ```bash
        cd frontend
        npm install leaflet react-leaflet reactflow
        npm install -D tailwindcss postcss autoprefixer @tailwindcss/postcss # For Tailwind v3, use: npm install -D tailwindcss postcss autoprefixer
        cd .. 
        ```
    * Create/replace the following files in the `frontend` directory with the code provided in the artifacts:
        * `frontend/public/index.html` (from `osint_crm_index_html`)
        * `frontend/public/manifest.json` (from `osint_crm_manifest_json`)
        * `frontend/src/App.js` (from `osint_crm_frontend_app_js_backend_connected`)
        * `frontend/src/index.css` (ensure Tailwind directives are present)
        * `frontend/tailwind.config.js` (from `osint_crm_tailwind_config`)
        * `frontend/postcss.config.js` (from `osint_crm_postcss_config_v3` if using Tailwind v3, or the one for `@tailwindcss/postcss` if using a newer setup that requires it)
        * `frontend/Dockerfile` (from `osint_crm_frontend_dockerfile_updated`)

3.  **Create Backend Structure & Files:**
    * Create a `backend` subdirectory: `mkdir backend`
    * Navigate into the `backend` directory: `cd backend`
    * Initialize a `package.json` file:
        ```bash
        npm init -y
        ```
    * Install backend dependencies:
        ```bash
        npm install express cors pg multer
        ```
    * Create the following files in the `backend` directory with the code provided:
        * `backend/server.js` (from `osint_crm_backend_server_js_db`)
        * `backend/Dockerfile` (from `osint_crm_backend_dockerfile`)
    * Navigate back to the project root: `cd ..`

4.  **Create Docker Compose File:**
    * In the root `osint-crm` directory, create `docker-compose.yml` (from `osint_crm_docker_compose_yml`).
    * **Important:** Review the `environment` variables in `docker-compose.yml` for the `db` and `backend` services, especially `DB_PASSWORD`. Change `changeme` to a secure password. You can create a `.env` file in the project root to manage these secrets, e.g.:
        ```env
        # .env
        DB_USER=postgres
        DB_PASSWORD=your_super_secret_password
        DB_NAME=osint_crm_db
        ```
        Docker Compose will automatically pick these up.

5.  **Build and Run with Docker Compose:**
    * From the root `osint-crm` directory, run:
        ```bash
        docker-compose up --build
        ```
        The first build might take some time as it downloads base images and installs dependencies.

6.  **Access the Application:**
    * Frontend: Open your browser and go to `http://localhost:8080`
    * Backend (test): `http://localhost:3001/api`

## Planned Future Features / Enhancements

* **Advanced Relationship Visualization:**
    * More sophisticated node types and styling in React Flow.
    * Dynamic layout algorithms.
    * Ability to add/edit relationships directly on the chart.
* **Enhanced Mapping:**
    * Clustering of map markers for performance with many locations.
    * Different marker types/colors based on location category or person status.
    * Drawing tools or area selection on the map.
* **Image & File Attachments for Persons:**
    * Backend API to handle file uploads for person profiles (not just logos).
    * Storage solution for these files (e.g., Docker volume or cloud storage).
    * UI in the `AddEditPersonForm` and `PersonDetailModal` to manage these attachments (upload, view, delete, add context).
* **Settings Page - Full Implementation:**
    * **Data Model Customization:** Allow users to add/edit/remove options for Person Categories, Statuses, OSINT Data Types, etc., directly from the UI.
    * **Data Import/Export:** Functionality to backup all application data (People, Tools, To-Dos, Settings) to a JSON/CSV file and import from such a file.
    * **Audit Log Display:** A proper UI to view and filter the audit log entries.
    * **Container Management (Limited):**
        * Display backend application logs (sanitized).
        * Potentially a "restart backend service" button (if feasible and secure). Direct Docker daemon control from within a container is generally not advised.
* **Enhanced Case Management:**
    * Treat "Cases" as a distinct entity, linking multiple people, tools, and findings.
    * Workflow and status tracking for cases.
* **User Authentication & Roles:** If the tool needs to support multiple users with different access levels.
* **Reporting Engine:** Generate reports from investigation data.
* **Plugin System / API Integrations:** Allow for direct integration with external OSINT tools or data sources.

This README should provide a good overview and setup guide for the project.
