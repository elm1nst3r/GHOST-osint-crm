# Dark Mode Text Legibility Fix

## Summary of Changes

This document outlines the systematic fix for dark mode text legibility issues across all components.

## Core Changes Made

### 1. Global Styles (index.css)
- Added dark mode body background and text colors
- Updated scrollbar colors for dark mode
- Background: `#111827` (gray-900)
- Text: `#f3f4f6` (gray-100)

### 2. Tailwind Config (tailwind.config.js)
Updated glass morphism effects for better dark mode visibility:
- **Glass card background**: Changed from `rgba(0,0,0,0.2)` to `rgba(30,41,59,0.4)` with slate tones
- **Glass button background**: Changed from pure black to slate tones with better opacity
- **Border colors**: Changed to `rgba(148,163,184,0.2)` for better visibility
- **Hover states**: Improved with brighter blue glow

### 3. App.js Background
- Changed dark mode background from `gray-900/800` to `slate-950/900/950`
- Reduced background decoration opacity in dark mode (20% → 10%, 15% → 8%)

## Text Color Guidelines

### Light Mode → Dark Mode Mappings

| Light Mode | Dark Mode | Usage |
|------------|-----------|-------|
| `text-gray-900` | `dark:text-gray-100` | Primary headings |
| `text-gray-800` | `dark:text-gray-200` | Secondary headings |
| `text-gray-700` | `dark:text-gray-300` | Body text |
| `text-gray-600` | `dark:text-gray-400` | Secondary text |
| `text-gray-500` | `dark:text-gray-500` | Muted text (same both modes) |
| `text-gray-400` | `dark:text-gray-600` | Disabled/placeholder text |

### Background Text Combinations

**For glass-card backgrounds:**
- Light mode: `text-gray-700` to `text-gray-900`
- Dark mode: `dark:text-gray-200` to `dark:text-gray-100`

**For white/light backgrounds:**
- Light mode: `text-gray-800` to `text-gray-900`
- Dark mode: `dark:text-gray-100`

**For gradient text (titles):**
```jsx
className="bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-gray-100 dark:to-gray-300"
```

## Specific Component Patterns

### Common Patterns to Fix

#### 1. Card Headers
```jsx
// Before
<h3 className="text-lg font-semibold text-gray-900">

// After
<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
```

#### 2. Description Text
```jsx
// Before
<p className="text-sm text-gray-600">

// After
<p className="text-sm text-gray-600 dark:text-gray-400">
```

#### 3. Muted/Secondary Text
```jsx
// Before
<span className="text-gray-500">

// After
<span className="text-gray-500 dark:text-gray-500">  // Often same both modes
```

#### 4. Table Headers
```jsx
// Before
<th className="text-gray-700 font-semibold">

// After
<th className="text-gray-700 dark:text-gray-300 font-semibold">
```

#### 5. Input Labels
```jsx
// Before
<label className="text-sm font-medium text-gray-700">

// After
<label className="text-sm font-medium text-gray-700 dark:text-gray-300">
```

#### 6. Buttons (Non-gradient)
```jsx
// Before
<button className="text-gray-700 hover:text-gray-900">

// After
<button className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
```

### Input Fields
```jsx
// Before
<input className="text-gray-900 placeholder-gray-400" />

// After
<input className="text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 dark:bg-slate-800" />
```

### Select Dropdowns
```jsx
// Before
<select className="text-gray-900" />

// After
<select className="text-gray-900 dark:text-gray-100 dark:bg-slate-800" />
```

### Textarea
```jsx
// Before
<textarea className="text-gray-900" />

// After
<textarea className="text-gray-900 dark:text-gray-100 dark:bg-slate-800" />
```

## Files Requiring Updates

Based on grep results, these files have text-gray- classes that need dark mode variants:

1. ✅ PeopleList.js
2. ✅ PeopleTableView.js
3. ✅ BulkRelationshipTool.js
4. GlobalMap.js
5. ObsidianGraph.js
6. RelationshipManager.js
7. AddEditToolForm.js
8. ToolsList.js
9. AddEditPersonForm.js
10. SettingsPage.js
11. PersonDetailModal.js
12. Dashboard.js
13. ReportGenerator.js
14. SystemHealth.js
15. RelationshipDiagram.js
16. DarkModeToggle.js (probably fine)
17. AddEditBusinessForm.js
18. BusinessList.js
19. TravelPatternAnalysis.js
20. CustomFieldManager.js

## Automated Fix Pattern

For each file:

1. Find all `text-gray-[X]00` without a `dark:` variant
2. Apply appropriate dark mode class based on the light mode value
3. Check gradient text has both `from-` and `to-` variants
4. Ensure input/select/textarea have dark backgrounds

## Testing Checklist

After applying fixes:

- [ ] Toggle dark mode in app
- [ ] Check all navigation items legible
- [ ] Verify all cards have readable text
- [ ] Test all form inputs readable
- [ ] Check all tables readable
- [ ] Verify all modals readable
- [ ] Test all dropdowns readable
- [ ] Check gradient text still works
- [ ] Verify glass morphism still looks good
- [ ] Test on actual dark background

## Known Good Patterns

### From App.js (Already Fixed)
```jsx
<h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-gray-100 dark:to-gray-300">

<p className="text-sm text-gray-500 dark:text-gray-400 font-medium">

className="glass-button text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
```

## Priority Components

1. **High Priority** (Most visible):
   - Dashboard.js
   - PeopleList.js
   - Navigation in App.js
   - GlobalMap.js

2. **Medium Priority**:
   - Forms (AddEditPersonForm, AddEditToolForm, etc.)
   - Detail modals
   - Table views

3. **Low Priority**:
   - Settings pages
   - Advanced features
   - Admin components

## Special Cases

### Gradient Backgrounds
When text is on a gradient background, ensure contrast in both modes:
```jsx
className="text-white"  // Works in both modes on gradient
```

### Status Badges
Status badges with colored backgrounds are usually fine:
```jsx
className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
```

### Icons
Icons should follow text color patterns:
```jsx
<Icon className="text-gray-600 dark:text-gray-400" />
```

## Implementation Notes

- Use Task agent for bulk updates if needed
- Test incrementally per component
- Check for regression in light mode
- Ensure glass effects remain translucent
- Verify backdrop-blur still works

---

**Status**: Core infrastructure complete, component updates in progress
**Last Updated**: October 2025
