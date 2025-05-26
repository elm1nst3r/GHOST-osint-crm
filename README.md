# 🕵️ OSINT Investigation CRM

> *"Because Excel sheets are for accountants, not investigators"*

Welcome to the most unnecessarily over-engineered investigation management system you never knew you needed. Built by a Cyber enthusiast that discovered vibe coding. 

## 🎯 What This Is Supposed To Do

This isn't your grandmother's contact manager. This is a full-stack investigation powerhouse that would make the FBI jealous (if they weren't already watching your GitHub commits).

### 🧑‍💼 People Management
- **Categorize humans like Pokémon cards**: Suspects, Witnesses, Persons of Interest, Associates, and Victims
- **Track their every move**: Addresses, phone numbers, emails, social media handles
- **Travel history**: Because where someone went last Tuesday matters
- **Case associations**: Link people to specific investigations
- **Status tracking**: Active, Inactive, Under Investigation, Cleared

### 🔗 Relationship Mapping
- **Visual conspiracy boards**: Interactive node diagrams
- **Connection types**: Family, Business, Criminal, Social, Unknown (for when things get spicy)
- **Drag-and-drop interface**: Because clicking is for peasants
- **Real-time updates**: Watch your investigation web grow like a beautiful, terrifying spider

### 🗺️ Global Intelligence Map
- **Geocoded locations**: Pin every address like you're planning world domination
- **Clustered markers**: Because nobody wants 1,000 pins exploding their browser
- **Person-location correlation**: See where your persons of interest have been lurking
- **Interactive popups**: Click for instant intel

### 🛠️ Tools & Resources Arsenal
- **OSINT tool inventory**: Track your favorite stalking—I mean, investigation tools
- **Categories**: Social Media, Background Check, Data Mining, Surveillance (the legal kind)
- **URL management**: One-click access to your digital weapons
- **Usage notes**: Because you'll forget how that weird Russian site works

### ✅ Task Management
- **Investigation todos**: Because even hackers need to-do lists
- **Priority levels**: Low, Medium, High, "THE BUILDING IS ON FIRE"
- **Status tracking**: Pending, In Progress, Completed, Abandoned (we don't judge)
- **Case assignment**: Link tasks to specific investigations

### 📊 Case Management
- **Multi-case support**: Handle multiple investigations without losing your sanity
- **Cross-referencing**: See how cases interconnect (plot twist: they always do)
- **Timeline tracking**: When did what happen and who was where

## 🚀 Getting This Monster Running

### Docker
Everything has been dockerized. Just download and run.
- **Clone the repo**
git clone <repo-url>
cd osint-crm

# Just run Docker - it handles everything!
docker-compose up --build

### Prerequisites
- **Node.js** (16+ or newer, because we're not animals)
- **PostgreSQL** (13+ recommended, because we need a real database)
- **A healthy sense of paranoia**
- **Coffee** (not technically required but highly recommended)

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

*The frontend will spawn at `http://localhost:3000` like a digital phoenix*

### Backend Setup
```bash
cd backend
npm install

# Set up your environment variables (secrets go in .env, not GitHub!)
cp .env.example .env
# Edit .env with your database credentials and JWT secrets

# Initialize the database (this creates tables, not evidence)
npm run db:init

# Start the backend server
npm start
```

*Backend runs on `http://localhost:5000` - the port of champions*

### Database Setup
1. **Create a PostgreSQL database** (name it something innocent)
2. **Update your `.env` file** with connection details
3. **Run the initialization script** to create all the tables
4. **Pray to the database gods** that everything works

## 🎮 Usage

1. **Start a new case** or continue investigating that weird neighbor
2. **Add people** with all their juicy details
3. **Map their connections** and watch the web of intrigue unfold
4. **Pin locations** on the global map
5. **Track your tools** and todos
6. **Profit** (or at least solve the case)

## ⚠️ Performance Notes

### Current Limitations
- **Map loading**: Takes forever with 200+ locations (working on it)
- **Relationship diagrams**: Start choking around 80+ nodes
- **Data loading**: Everything loads at once like it's 2010

### Recommended Limits
- **People**: Keep it under 2,000 for optimal performance
- **Locations**: 500+ locations will make the map sad
- **Connections**: 10,000+ relationships = browser death

*Future updates will include pagination, lazy loading, and other fancy optimizations*

## 🤝 Contributing

Found a bug? Want to add a feature? Think our code is terrible? 

1. **Fork the repo** (it's like stealing, but legal)
2. **Create a branch** (`git checkout -b feature/mind-reading-ai`)
3. **Make your changes** (try not to break everything)
4. **Test thoroughly** (seriously, you will be judged)
5. **Submit a PR** with a description that doesn't suck

## 📜 License

MIT License - Because sharing is caring, and lawyers are expensive.

## 🙈 Disclaimer

This tool is intended for **legitimate investigation purposes only**. We are not responsible for:
- Stalking charges
- International incidents
- Accidentally uncovering government conspiracies
- Your significant other finding out you're tracking their ex
- The inevitable robot uprising

Use responsibly, stay legal, and remember: just because you *can* investigate someone doesn't mean you *should*.

## 🆘 Support

Having issues? Ask your friendly neighbourhood LLM - I would do the same

1. **Check the logs** (they usually tell you what went wrong)
2. **LLM the error** (Claude, Gemini, etc)
3. **Create an issue** on GitHub
4. **Sacrifice a rubber duck** to the coding gods

## Feedback and Inputs
Please do drop a line and let me know how you like it. Any feedback, Inputs and rants are highly welcome.

---

Built with ❤️ and an unhealthy amount of paranoia.
