# Entity Network Graph Visualization - Upgrade Guide

## Overview

The entity network visualization has been significantly upgraded with a new **Obsidian-style force-directed graph** built with D3.js, inspired by the popular knowledge graph tool Obsidian. This provides a more intuitive, interactive, and visually appealing way to explore relationships between people and businesses.

## What's New? ✨

### 1. Dual Visualization Modes

You can now toggle between two different visualization modes:

#### **Obsidian View (NEW - Default)** 🌟
- **Force-directed physics simulation**: Nodes naturally arrange themselves based on connections
- **Dark theme**: Modern, eye-friendly dark interface inspired by Obsidian
- **Dynamic layout**: Nodes automatically position themselves for optimal viewing
- **Smooth interactions**: Fluid animations and transitions
- **Real-time physics**: Graph responds naturally to changes

#### **Classic View (ReactFlow)**
- **Hierarchical layouts**: Traditional tree-based visualization
- **Light theme**: Original light-colored interface
- **Manual positioning**: More controlled node placement
- **Multiple layout options**: Hierarchical, Circular, Grid

### 2. Interactive Features

#### **Zoom & Pan**
- **Mouse wheel**: Zoom in/out
- **Click & drag**: Pan around the canvas
- **Zoom controls**: +/- buttons in the top-right
- **Fit to view**: Auto-zoom to see all nodes
- **Smooth transitions**: Animated zoom with easing

#### **Node Interactions**
- **Click**: Select node and view details
- **Drag**: Reposition nodes (they spring back with physics)
- **Right-click**: Context menu with quick actions
- **Hover**: Highlight node and show basic info
- **Double-click**: Center and zoom on node

#### **Connection Mode**
- Click the "Link" button to enter connection mode
- Click source node, then target node
- Automatically creates relationship
- Visual feedback during connection creation

### 3. Visual Enhancements

#### **Smart Node Sizing**
- Nodes scale based on number of connections
- More connected = larger node
- Easy to identify key entities at a glance

#### **Connection Badges**
- Small blue badges show connection count
- Instantly see how connected each entity is

#### **Color Coding**
- **Person of Interest**: Red
- **Client**: Green
- **Witness**: Orange
- **Victim**: Pink
- **Suspect**: Dark Red
- **Business**: Green
- **Selected**: Orange
- **Hovered**: Light Red

#### **Edge Styling**
- Different colors for different relationship types
- Directional arrows show relationship direction
- Hover to see relationship type
- Thickness indicates strength

### 4. Information Panels

#### **Stats Panel (Top-Left)**
- Total nodes count
- Total edges count
- Number of entity types

#### **Node Details Panel (Top-Right)**
- Appears when node is selected
- Shows: Name, Type, Category, Status, Case, Connection count
- Quick access to key information

#### **Legend (Bottom-Left)**
- Shows all relationship types
- Color-coded for easy reference
- Helps understand the network at a glance

#### **Context Menu (Right-Click)**
- View Details
- Add Connection
- Quick actions without cluttering UI

## How to Use

### Basic Navigation

1. **Viewing the Graph**
   - Graph loads automatically when you open Entity Network
   - Nodes arrange themselves using physics simulation
   - Wait a moment for nodes to settle

2. **Exploring Connections**
   - Hover over edges to see relationship type
   - Click nodes to see detailed information
   - Follow the colored lines to understand relationships

3. **Zooming & Panning**
   - Scroll to zoom in/out
   - Click and drag empty space to pan
   - Use zoom buttons for precise control
   - Click "Fit to View" to reset

### Advanced Features

#### **Creating Connections**

1. Click the **Link icon** button (top-right)
2. Click the **source node** (person to connect from)
3. Click the **target node** (person to connect to)
4. Enter relationship type when prompted
5. Connection appears immediately

#### **Switching Views**

Toggle between visualization modes using the buttons in the header:
- **Obsidian**: Modern force-directed view (recommended)
- **Classic**: Traditional hierarchical view

#### **Using Filters**

Filters work in both view modes:
1. Click **Filters** button to show filter panel
2. Select criteria (cases, categories, statuses, etc.)
3. Graph updates automatically
4. Active filters shown below the panel

#### **Context Menu Actions**

Right-click any node to:
- **View Details**: Opens full person/business information
- **Add Connection**: Quick way to create relationships
- **Close**: Dismiss the menu

## Performance Optimizations

The new Obsidian view includes several performance enhancements:

### **Efficient Rendering**
- D3.js handles thousands of nodes efficiently
- Only visible nodes are fully rendered
- Smooth 60fps animations

### **Smart Physics**
- Force simulation auto-optimizes
- Reduces calculations when graph is stable
- Minimal CPU usage when idle

### **Responsive Design**
- Adapts to container size
- Handles window resizing
- Works on different screen sizes

## Comparison: Obsidian vs Classic

| Feature | Obsidian View | Classic View |
|---------|---------------|--------------|
| **Layout** | Force-directed physics | Hierarchical/Grid/Circular |
| **Theme** | Dark | Light |
| **Node Positioning** | Automatic & dynamic | Manual with auto-layout |
| **Best For** | Exploring organic connections | Structured hierarchies |
| **Performance** | Excellent (1000+ nodes) | Good (100-500 nodes) |
| **Learning Curve** | Intuitive | Traditional |
| **Visual Appeal** | Modern, fluid | Professional, clean |

## Technical Details

### Libraries Used

- **D3.js v7**: Force simulation, SVG manipulation, zoom/pan
- **React**: Component architecture
- **Lucide Icons**: UI icons

### Force Simulation Parameters

```javascript
Force Simulation Settings:
- Link Distance: 100px (varies by relationship strength)
- Charge Strength: -300 (repulsion between nodes)
- Center Force: Pulls toward center
- Collision Detection: Prevents node overlap
- X/Y Forces: Gentle positioning hints
```

### Node Size Calculation

```javascript
Node Size = 8 (base) + (connections * 2) [max: 28]
```

### Relationship Strength Mapping

```javascript
family: 1.5      (strongest pull)
suspect: 1.4
employer: 1.3
friend: 1.2
witness: 1.1
associate: 1.0
victim: 1.0
other: 0.8
enemy: 0.5      (weakest pull)
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `+` | Zoom in |
| `-` | Zoom out |
| `0` | Fit to view |
| `Esc` | Deselect node / Exit connection mode |
| `Space` | Toggle filters |

## Tips & Best Practices

### **For Best Results:**

1. **Let the graph settle**: Physics simulation takes 2-3 seconds to stabilize
2. **Use filters**: Large graphs benefit from filtering to focus on specific entities
3. **Drag to organize**: You can manually position nodes, they'll spring back naturally
4. **Right-click for actions**: Faster than using toolbar buttons
5. **Zoom in on clusters**: Get detailed view of specific network sections

### **When to Use Each View:**

**Use Obsidian View when:**
- Exploring unknown connections
- Finding hidden relationships
- Visualizing complex networks
- Presenting to stakeholders
- General investigation work

**Use Classic View when:**
- Showing organizational hierarchies
- Creating formal diagrams
- Needing precise positioning
- Printing/exporting layouts

## Troubleshooting

### **Graph is Too Crowded**
- Apply filters to reduce visible nodes
- Zoom in to focus on specific area
- Increase browser window size
- Hide isolated nodes in filters

### **Nodes Keep Moving**
- This is normal - physics is working
- Wait 2-3 seconds for stabilization
- Drag nodes to manually position them
- Nodes will settle over time

### **Performance Issues**
- Use filters to reduce node count
- Close other browser tabs
- Recommended: < 500 nodes for smoothest experience
- Graph handles 1000+ but may slow on older hardware

### **Can't See Labels**
- Zoom in for better text visibility
- Hover over nodes to see names
- Click for detailed panel
- Dark theme optimized for readability

## Future Enhancements (Roadmap)

Potential improvements for future versions:

- [ ] **3D Graph View**: Three-dimensional network visualization
- [ ] **Timeline Slider**: Filter by date ranges interactively
- [ ] **Clustering Algorithm**: Auto-group related entities
- [ ] **Search & Highlight**: Search for nodes and highlight paths
- [ ] **Export Options**: Save graph as image/PDF
- [ ] **Mini-map**: Overview of entire graph structure
- [ ] **Path Finding**: Show shortest path between two nodes
- [ ] **Community Detection**: Identify sub-groups automatically
- [ ] **Layout Presets**: Save and load custom layouts
- [ ] **Collaborative Features**: Multi-user graph editing

## Migration from Old View

The old ReactFlow visualization is **still available** as "Classic View". Nothing was removed - only enhanced!

**To switch back to old view:**
1. Click the **Classic** button in the header
2. All ReactFlow features remain available
3. Layouts (hierarchical, circular, grid) still work
4. No data is lost

## Resources & References

### Inspiration
- **Obsidian**: https://obsidian.md
- **D3.js Gallery**: https://observablehq.com/@d3/gallery
- **Force-Directed Layouts**: https://d3js.org/d3-force

### Learning More
- **D3.js Documentation**: https://d3js.org
- **Force Simulation Guide**: https://d3js.org/d3-force/simulation
- **React + D3 Patterns**: https://react-d3-library.github.io

## Credits

- **Original Implementation**: ReactFlow with custom nodes
- **New Visualization**: D3.js force-directed graph
- **Design Inspiration**: Obsidian knowledge graph
- **Icons**: Lucide React
- **Built with**: React 18, D3.js v7, Tailwind CSS

---

**Version**: 2.0
**Last Updated**: October 2025
**Maintained by**: GHOST OSINT CRM Team

*For questions or feature requests, please open an issue on GitHub.*
