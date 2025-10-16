# People Table View & Bulk Operations Guide

## Overview

This guide covers the new table view and bulk operation features added to the People Management section of GHOST OSINT CRM. These features enable faster data entry, bulk imports, and efficient relationship management.

---

## Features Added

### 1. **Table View Toggle**
Switch between card view (original) and table view for different workflows.

**Location**: People Management page, top-right toggle buttons

**Usage**:
- Click **Cards** button for visual card layout
- Click **Table** button for compact table layout

**When to use table view**:
- Quick data entry and editing
- Comparing multiple people side-by-side
- Bulk operations (import/export)
- Working with large datasets

---

## Table View Features

### 2. **Quick Add Row**

Instantly add new people directly in the table without opening a form.

**How to use**:
1. Click the **Quick Add** button in the toolbar
2. Fill in the fields that appear at the top of the table:
   - First Name (required)
   - Last Name
   - Category (dropdown)
   - Status (dropdown)
   - Case (dropdown)
   - Notes
3. Click **Add** button to create the person
4. The row clears and is ready for the next entry

**Benefits**:
- No modal popups - stay focused on your work
- See existing data while adding new entries
- Perfect for rapid data entry from documents or lists

---

### 3. **Inline Editing**

Edit any person's details directly in the table.

**How to use**:
1. Click the **pencil (Quick Edit)** icon on any row
2. Fields become editable input boxes
3. Modify any fields you need to change
4. Click **Save** (checkmark) or **Cancel** (X) button

**Available actions per row**:
- **Eye icon**: View full details (opens detail modal)
- **Single pencil**: Quick edit (inline editing)
- **Filled pencil**: Full edit (opens full form modal)
- **Trash icon**: Delete person

**Editable fields**:
- First Name
- Last Name
- Category
- Status
- Case Name

---

### 4. **CSV Import**

Bulk import people from CSV files.

**How to use**:
1. Click **Import CSV** button in toolbar
2. Select a CSV file from your computer
3. Review the import summary
4. Data is automatically validated and imported

**CSV Format**:
```csv
First Name,Last Name,Category,Status,Case,Notes,Aliases
John,Doe,Person of Interest,Open,Case Alpha,Suspicious activity,Johnny;JD
Jane,Smith,Witness,Closed,Case Beta,Reliable source,
```

**Supported column names** (case-insensitive):
- `First Name` / `FirstName` / `firstname`
- `Last Name` / `LastName` / `lastname`
- `Category`
- `Status`
- `Case` / `Case Name` / `CaseName`
- `Notes`
- `Aliases` (semicolon-separated: `Alias1;Alias2;Alias3`)

**Import behavior**:
- First Name is required (rows without it are skipped)
- Missing optional fields use defaults:
  - Category: "Person of Interest"
  - Status: "Open"
- Validation errors are reported in summary
- Successfully imported people are immediately visible

---

### 5. **CSV Export**

Export all people (or filtered subset) to CSV.

**How to use**:
1. Apply any filters/search you want (optional)
2. Click **Export CSV** button
3. File downloads automatically as `people-export-YYYY-MM-DD.csv`

**Exported columns**:
- First Name
- Last Name
- Category
- Status
- Case
- Notes
- Connections (count)

**Use cases**:
- Backup your data
- Share data with team members
- Import into spreadsheet for analysis
- Migrate data to other systems

---

## Bulk Relationship Tool

Create multiple relationships between people in one operation.

**How to access**:
- Click **Bulk Relationships** button in table view toolbar

### Interactive Mode

Add relationships one by one using dropdown menus.

**How to use**:
1. Open Bulk Relationships tool
2. Select **Interactive** tab (default)
3. For each relationship:
   - **From Person**: Select from dropdown
   - **To Person**: Select from dropdown
   - **Type**: Select relationship type
   - **Note**: Optional description
4. Click **+ Add Relationship** for more rows
5. Click **Create Relationships** when done

**Relationship Types**:
- Family
- Friend
- Enemy
- Associate
- Employer
- Suspect
- Witness
- Victim
- Other

**Features**:
- Add unlimited relationships at once
- Remove rows with X button
- Duplicate checking (updates existing connections)
- Error reporting for invalid data

---

### CSV Import Mode

Bulk import relationships from CSV data.

**How to use**:
1. Open Bulk Relationships tool
2. Click **CSV Import** tab
3. Paste CSV data or type it directly
4. Click **Create Relationships**

**CSV Format**:
```csv
From,To,Type,Note
John Doe,Jane Smith,family,Siblings
Jane Smith,Bob Williams,associate,Business partners
Alice Johnson,John Doe,friend,College roommates
```

**Supported column names** (case-insensitive):
- `From` / `Source` / `Person 1`
- `To` / `Target` / `Person 2`
- `Type` / `Relationship Type`
- `Note` / `Notes`

**Name Matching**:
The tool uses fuzzy matching to find people:
- Case-insensitive
- Matches "First Last" format
- Matches "Last, First" format
- Matches first name only
- Matches last name only (if unique)

**Examples of valid names**:
- `John Doe`
- `Doe, John`
- `john doe` (case doesn't matter)
- `John` (if only one person named John)

**Error Handling**:
- Person not found: Error reported, relationship skipped
- Invalid data: Error reported, relationship skipped
- Duplicate connections: Existing relationship is updated
- Summary shows: Created count, Error count, Error details

---

## Tips & Best Practices

### Table View Performance
- Table view is optimized for up to 500 rows
- Use filters to reduce visible data if needed
- Export filtered data for focused CSV files

### Quick Add Workflow
1. Have your source document open
2. Open Quick Add row
3. Tab through fields for keyboard-only entry
4. Press Enter to save (if implemented) or click Add
5. Repeat for next person

### CSV Import Best Practices
- Always include header row
- Use UTF-8 encoding for special characters
- Test with small file first (5-10 rows)
- Keep backup of original data
- Review import summary for errors

### Bulk Relationships Best Practices
- Use consistent name format throughout
- Use CSV mode for large batches (20+ relationships)
- Use Interactive mode for quick manual entry (1-10 relationships)
- Add notes to document relationship context
- Review relationship count in table after import

### Data Validation
- Names should match exactly (case-insensitive)
- Categories must match predefined values
- Statuses must match predefined values
- Invalid data is automatically flagged

---

## Keyboard Shortcuts

**Table Navigation**:
- `Tab` / `Shift+Tab`: Move between fields
- `Enter`: Save inline edit (when implemented)
- `Escape`: Cancel inline edit (when implemented)

**Quick Add**:
- `Tab`: Move to next field
- `Enter`: Submit form (when implemented)

---

## Workflow Examples

### Example 1: Rapid Data Entry from Investigation Report

**Scenario**: You have a report listing 20 people involved in a case.

**Workflow**:
1. Switch to Table view
2. Click **Quick Add**
3. For each person in report:
   - Type First Name, Last Name
   - Select Category from dropdown
   - Select Case from dropdown
   - Click Add
4. When done, export to CSV as backup

**Time saved**: ~5 minutes vs. using 20 separate forms

---

### Example 2: Import Organization Membership List

**Scenario**: You have a spreadsheet of organization members.

**Workflow**:
1. Open spreadsheet, add headers: `First Name,Last Name,Category,Status,Case`
2. Set Category = "Person of Interest" for all
3. Set Status = "Open" for all
4. Set Case = "Organization Investigation"
5. Export to CSV
6. In GHOST: Click **Import CSV**, select file
7. Review import summary
8. Switch to table view to verify data

**Time saved**: ~30 minutes vs. manual entry

---

### Example 3: Bulk Add Family Relationships

**Scenario**: You've identified a family network of 15 people with 25 relationships.

**Workflow**:
1. First, import all 15 people via CSV:
   ```csv
   First Name,Last Name,Category,Status,Case
   John,Smith,Person of Interest,Open,Smith Family
   Mary,Smith,Person of Interest,Open,Smith Family
   ...
   ```

2. Create relationship CSV:
   ```csv
   From,To,Type,Note
   John Smith,Mary Smith,family,Spouse
   John Smith,Alice Smith,family,Daughter
   Mary Smith,Alice Smith,family,Daughter
   ...
   ```

3. Click **Bulk Relationships** → **CSV Import**
4. Paste relationship data
5. Click **Create Relationships**
6. Review in Entity Network view

**Time saved**: ~45 minutes vs. manual entry

---

## Troubleshooting

### Issue: "Person not found" error in bulk relationships

**Cause**: Name doesn't match exactly what's in the system

**Solutions**:
1. Check spelling and spacing
2. Try different name format (First Last vs Last, First)
3. Export people to CSV to see exact names
4. Use autocomplete (if available) to verify names

---

### Issue: CSV import creates duplicate people

**Cause**: Names are similar but not exact matches

**Prevention**:
1. Always check for existing people first
2. Use consistent name format
3. Export existing people to reference during import
4. Review import summary before confirming

**Solution**:
- Delete duplicates manually
- Use Full Edit to merge data
- Re-import with corrected names

---

### Issue: Inline edit doesn't save

**Cause**: Required fields are empty or invalid

**Solutions**:
1. Ensure First Name is filled
2. Check that Category and Status have valid values
3. Look for error messages
4. Cancel and try Full Edit mode instead

---

### Issue: Relationship type not recognized

**Cause**: CSV uses custom type not in predefined list

**Solution**:
1. Replace with closest predefined type:
   - family, friend, enemy, associate, employer
   - suspect, witness, victim, other
2. Use "other" for custom relationships
3. Add detail in Note field

---

## File Locations

**Frontend Components**:
- `frontend/src/components/PeopleTableView.js` - Main table view
- `frontend/src/components/BulkRelationshipTool.js` - Bulk relationship tool
- `frontend/src/components/PeopleList.js` - People management (updated with toggle)

**Key Functions**:
- `handleQuickAdd()` - Quick add row submission
- `handleBulkImport()` - CSV import processing
- `submitInteractiveRelationships()` - Interactive mode relationships
- `submitCSVRelationships()` - CSV mode relationships

---

## Future Enhancements

Potential improvements for future versions:

1. **Keyboard Shortcuts**
   - Enter to save inline edits
   - Ctrl+S for quick save
   - Arrow keys for navigation

2. **Advanced Filtering**
   - Multi-select filters
   - Save filter presets
   - Export filtered results

3. **Batch Operations**
   - Select multiple rows (checkboxes)
   - Bulk delete
   - Bulk category change
   - Bulk case assignment

4. **Enhanced Import**
   - Drag-and-drop CSV upload
   - Excel file support (.xlsx)
   - Column mapping interface
   - Duplicate detection/merge

5. **Relationship Visualization**
   - Preview relationships before import
   - Relationship validation (circular detection)
   - Relationship templates

---

## Support

**Documentation**:
- This guide: `TABLE_VIEW_GUIDE.md`
- Main README: `README.md`
- CLAUDE.md: Project instructions

**For Issues**:
- Check console for detailed errors
- Review import summaries for specific issues
- Export data regularly as backup

---

**Last Updated**: October 2025
**Version**: 1.0
**Components**: PeopleTableView, BulkRelationshipTool
**Status**: ✅ Complete and integrated
