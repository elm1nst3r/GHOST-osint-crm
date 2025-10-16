# 👻 GHOST - Global Human Operations & Surveillance Tracking
## OSINT Investigation CRM

> *"Because Excel sheets are for accountants, not investigators"*

A full-stack OSINT investigation management system built for serious intelligence gathering with a modern, professional interface.

## 🎯 Core Features

### 🧑‍💼 People Management
- **Role-based categorization**: Suspects, Witnesses, Persons of Interest, Associates, Victims
- **Comprehensive tracking**: Addresses, phone numbers, emails, social media handles
- **Travel history**: Timeline and analysis of person movements
- **Case associations**: Link people to specific investigations
- **Status tracking**: Active, Inactive, Under Investigation, Cleared
- **Custom fields**: Extend person profiles with custom data fields
- **Advanced search**: Multi-parameter search with filters

### 🔗 Entity Network Visualization
- **Interactive relationship diagrams**: Visual network mapping with ReactFlow
- **Multi-entity support**: People, businesses, locations, phones, emails
- **Connection types**: Family, Business, Criminal, Social, Known Associates
- **Drag-and-drop interface**: Intuitive node manipulation
- **Real-time updates**: Live relationship mapping
- **Network filtering**: Focus on specific entity types and relationships

### 🗺️ Global Intelligence Map
- **Geocoded locations**: Automatically geocode addresses with database caching
- **Clustered markers**: Performance-optimized clustering for large datasets
- **Person-location correlation**: Visual tracking of person movements
- **Interactive popups**: Detailed location information on click
- **Map filters**: Filter by person, date range, or location type

### 📡 Wireless Network Intelligence (WiGLE Integration)
- **KML import**: Import WiGLE wardriving data
- **Network tracking**: SSID, BSSID, encryption, signal strength
- **Person association**: Link wireless networks to investigations
- **Map visualization**: Geographic network mapping with labels
- **Advanced filtering**: Filter by signal strength, encryption, KML file source
- **Location preview**: Interactive map in detail view

### 🛠️ Tools & Resources Arsenal
- **OSINT tool inventory**: Catalog of investigation tools
- **Categories**: Social Media, Background Check, Data Mining, Surveillance
- **URL management**: One-click access to tools
- **Usage notes**: Documentation and tips
- **Search and filtering**: Quick tool discovery

### ✅ Task Management
- **Investigation todos**: Linked to cases and people
- **Priority levels**: Low, Medium, High, Urgent
- **Status tracking**: Pending, In Progress, Completed
- **Case assignment**: Organize tasks by investigation

### 📊 Case Management
- **Multi-case support**: Manage multiple investigations
- **Status tracking**: Custom case statuses and data types
- **Case-person linking**: Associate people with cases
- **Timeline tracking**: Investigation chronology
- **Cross-referencing**: See case interconnections

### 🏢 Business Intelligence
- **Business tracking**: Companies and organizations
- **Employee mapping**: Track personnel
- **Business relationships**: Link to people and other businesses
- **Address and contact management**: Full business profiles

### 🌓 Modern UI/UX
- **Glass morphism design**: Professional, translucent interface
- **Dark mode**: Full dark mode support
- **Responsive layout**: Works on desktop and tablet
- **Professional colorway**: Business-appropriate aesthetics
- **Smooth animations**: Apple-inspired interactions

## 🚀 Quick Start (Docker)

The easiest way to run GHOST is with Docker:

```bash
# Clone the repository
git clone <repo-url>
cd GHOST-osint-crm

# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Start all services
docker-compose up --build
```

**Access the application:**
- Frontend: http://localhost:8080
- Backend API: http://localhost:3001
- Database: PostgreSQL on port 5432

## 📋 Prerequisites

- **Docker & Docker Compose** (recommended)
- **OR Manual Setup:**
  - Node.js 18+
  - PostgreSQL 15+
  - npm or yarn

## 🔧 Manual Setup

### Frontend
```bash
cd frontend
npm install
npm start
```
Frontend runs on `http://localhost:3000`

### Backend
```bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Start server
npm start
```
Backend runs on `http://localhost:3001`

### Database
```bash
# Create database
createdb osint_crm_db

# Run migrations (from backend directory)
psql -U postgres -d osint_crm_db < migrations/create_wireless_networks.sql
```

## 📁 Project Structure

```
GHOST-osint-crm/
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── utils/         # API utilities
│   │   └── index.css      # Tailwind styles
│   ├── public/            # Static assets
│   └── nginx.conf         # Nginx configuration
├── backend/               # Node.js/Express API
│   ├── server.js          # Main server file
│   ├── migrations/        # Database migrations
│   └── public/uploads/    # File uploads
├── docker-compose.yml     # Docker configuration
└── .env.example           # Environment template
```

## 🎮 Usage Guide

### Starting a New Investigation
1. **Create a case** in the Cases section
2. **Add people** with all relevant details
3. **Map connections** in Entity Network view
4. **Track locations** on the Global Map
5. **Import wireless networks** (if using WiGLE data)
6. **Assign tasks** to track investigation progress

### Wireless Network Intelligence
1. Export KML from WiGLE app/website
2. Go to Wireless Networks section
3. Click "Import KML"
4. Upload your KML file
5. Networks appear on map and table
6. Associate networks with people under investigation

### Entity Network Mapping
1. Navigate to "Entity Network" section
2. View interactive relationship diagram
3. Filter by entity types and relationships
4. Click nodes for details
5. Add connections between entities

## ⚡ Performance Notes

**Optimized for:**
- Up to 5,000 people records
- Up to 10,000 wireless networks
- Up to 1,000 locations on map
- Up to 500 relationship nodes

**Features:**
- Database-level geocoding cache
- Map marker clustering
- Pagination ready (future enhancement)
- Lazy loading support

## 🔐 Security Considerations

**Important:**
- Never commit `.env` files
- Keep `backend/public/uploads/` out of version control
- Secure your PostgreSQL database
- Use strong JWT secrets
- Review uploaded files for security
- Follow local laws for data collection

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License**.

**You are free to:**
- ✅ Use for personal investigations
- ✅ Use for educational purposes
- ✅ Use for research
- ✅ Modify and improve
- ✅ Share with others

**Under these conditions:**
- 📝 **Attribution** - Give appropriate credit
- 🚫 **NonCommercial** - No commercial use without permission
- 🔄 **ShareAlike** - Share modifications under same license

**Commercial use requires explicit permission from the author.**

For commercial licensing, contact: hurdles.remand_9g [at] icloud.com

## 🙈 Legal Disclaimer

This tool is intended for **legitimate OSINT investigation purposes only**. Users are responsible for:
- Complying with all applicable laws and regulations
- Respecting privacy rights and data protection laws
- Using the tool ethically and responsibly
- Obtaining proper authorization for investigations

The authors are not responsible for misuse of this software.

## 🆘 Support

**Having issues?**

1. Check Docker logs: `docker-compose logs`
2. Review backend logs for API errors
3. Check browser console for frontend errors
4. Verify database connection
5. Open an issue on GitHub with details

## 💬 Feedback

Feedback, inputs, and suggestions are highly welcome! Please open an issue or reach out directly.

## 🛠️ Tech Stack

**Frontend:**
- React 18
- Tailwind CSS
- Leaflet (maps)
- ReactFlow (diagrams)
- Lucide Icons

**Backend:**
- Node.js / Express
- PostgreSQL 15
- xml2js (KML parsing)

**Infrastructure:**
- Docker & Docker Compose
- Nginx (reverse proxy)

---

Built with ❤️ for the OSINT community.

**Version:** 2.0
**Last Updated:** October 2025
