# Graph Visualization - Quick Start Guide

## 🚀 5-Minute Quick Start

### Starting the Graph

1. Navigate to **Entity Network** in the sidebar
2. The new **Obsidian view** loads by default
3. Wait 2-3 seconds for nodes to settle
4. Start exploring!

## 🎮 Controls Cheat Sheet

### Mouse Controls
| Action | How To |
|--------|---------|
| **Zoom In/Out** | Scroll up/down |
| **Pan** | Click & drag empty space |
| **Select Node** | Left-click node |
| **Move Node** | Click & drag node |
| **Quick Actions** | Right-click node |
| **Deselect** | Click empty space |

### Button Controls
| Button | What It Does |
|--------|--------------|
| **Obsidian/Classic** | Switch between view modes |
| **Filters** | Show/hide filter panel |
| **+ / -** | Zoom in/out |
| **⛶** | Fit entire graph to view |
| **🔗** | Enter connection mode |
| **↻** | Refresh data |

## ✨ Quick Tips

### 1. Understanding Node Colors
- **Red**: Person of Interest / Suspect
- **Green**: Client / Business
- **Orange**: Witness
- **Pink**: Victim
- **Blue**: Default person

### 2. Connection Badges
Small blue circles on nodes show how many connections they have.

### 3. Reading Relationships
- **Lines** connect related entities
- **Colors** indicate relationship type (see legend)
- **Arrows** show direction
- **Hover** over lines to see relationship type

### 4. Creating Connections

**Method 1: Connection Mode**
1. Click Link button (🔗)
2. Click source node
3. Click target node
4. Enter type when prompted

**Method 2: Context Menu**
1. Right-click source node
2. Select "Add Connection"
3. Click target node
4. Enter type

### 5. Using Filters

To focus on specific entities:
1. Click **Filters** button
2. Select your criteria:
   - Search by name
   - Filter by case
   - Filter by category
   - Filter by status
   - Minimum connections
3. Graph updates automatically

## 🎯 Common Tasks

### Find Highly Connected People
1. Click **Filters**
2. Set "Min Connections" to 3 or more
3. Look for larger nodes

### Explore a Case
1. Click **Filters**
2. Select specific case from dropdown
3. View only entities in that case

### Center on Specific Person
1. Click the person's node
2. Details panel appears on right
3. Node is highlighted in orange

### Export/Share View
Currently: Take screenshot
Future: Export as image (coming soon)

## 🐛 Troubleshooting

### Nodes Keep Moving
✅ **Normal!** Physics simulation is working.
- Wait 2-3 seconds to settle
- Or drag nodes to position manually

### Can't See Text
- Zoom in closer
- Hover over nodes
- Click for detail panel

### Graph Too Crowded
- Use filters to reduce nodes
- Focus on specific case
- Hide isolated nodes

### Performance Slow
- Apply filters (reduce node count)
- Use Classic view for very large graphs
- Recommended: < 500 nodes for best performance

## 🔄 Switching Views

### When to Use Each View

**Use Obsidian View (Default) for:**
- General exploration
- Finding patterns
- Discovering relationships
- Beautiful presentations

**Use Classic View for:**
- Formal org charts
- Hierarchical structures
- Precise positioning
- Printing/exporting

**To Switch:**
Click **Obsidian** or **Classic** button in header

## 📱 Mobile/Tablet

The graph works on mobile but is optimized for desktop:
- Touch to select
- Pinch to zoom
- Two-finger drag to pan
- Tap and hold for context menu

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Deselect / Cancel connection mode |
| `+` | Zoom in |
| `-` | Zoom out |
| `0` | Fit to view |

## 💡 Pro Tips

1. **Let it breathe**: Don't interact immediately - let physics settle first
2. **Right-click is your friend**: Fastest way to access actions
3. **Use filters liberally**: Even with small graphs, filters help focus
4. **Drag to organize**: Pull apart clusters to see better
5. **Look for patterns**: Highly connected nodes are often key entities

## 🆘 Need More Help?

- Full documentation: `GRAPH_VISUALIZATION.md`
- Video tutorials: Coming soon
- Report issues: GitHub issues

## 🎓 Learn By Doing

Try these exercises:

1. **Find the most connected person**
   - Look for the largest node
   - Check connection badge
   - Click to see details

2. **Trace a relationship path**
   - Pick two people
   - Follow the colored lines between them
   - Note relationship types

3. **Filter by category**
   - Open filters
   - Select "Suspect" category
   - See suspect network

4. **Create a connection**
   - Enable connection mode
   - Link two people
   - Choose relationship type

---

**Remember**: The Obsidian view is meant to be explored intuitively. Play around, drag nodes, zoom in and out - you can't break anything!

**Default View**: Obsidian (force-directed)
**Fallback**: Classic view always available
**Data**: Real-time from your database

Enjoy your new visualization! 🎉
