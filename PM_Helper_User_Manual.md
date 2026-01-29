# PM Helper - User Manual

## Jira Task Generator for Project Managers

**Version 1.0**
**Renderspace Digital Agency**

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Generate Tab](#generate-tab)
4. [History Tab](#history-tab)
5. [Templates Tab](#templates-tab)
6. [Exporting to Jira](#exporting-to-jira)
7. [Tips & Best Practices](#tips--best-practices)
8. [Troubleshooting](#troubleshooting)

---

## 1. Overview

PM Helper is an AI-powered tool that automatically generates Jira-ready task breakdowns from project offers and briefs. Simply upload your offer document or paste the text, and the AI will analyze it to create a comprehensive list of tasks organized by type, priority, and project phase.

### Key Features

- **Document Upload**: Support for PDF, Word (.docx), and text files
- **AI-Powered Analysis**: Automatically detects project scope, deliverables, and requirements
- **Multi-Language Support**: Generate tasks in English or Slovenian
- **Task Selection**: Choose which tasks to export with checkboxes
- **CSV Export**: Download tasks in Jira-compatible CSV format
- **History**: Save and revisit previous generations
- **Templates**: Save task sets as reusable templates

---

## 2. Getting Started

### Accessing PM Helper

1. Log into the Renderspace Project Intelligence dashboard
2. Click on **"PM Helper"** in the left sidebar navigation
3. You'll see three tabs: **Generate**, **History**, and **Templates**

### System Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection for AI processing
- Supported file formats: PDF, DOCX, TXT, MD

---

## 3. Generate Tab

The Generate tab is where you create new task breakdowns from project offers.

### Step 1: Select Output Language

Before uploading your offer, choose the language for generated tasks:

- **English**: Tasks will be written in English
- **Slovenian**: Tasks will be written in Slovenian (Naloge bodo v slovenščini)

Click the appropriate button to select your preferred language.

### Step 2: Upload or Paste Offer

You have two options for providing the project offer:

#### Option A: Upload a File

1. Click on the upload area or drag and drop a file
2. Supported formats:
   - **PDF** (.pdf) - Offer documents, proposals
   - **Word** (.docx) - Microsoft Word documents
   - **Text** (.txt, .md) - Plain text files
3. Wait for the document to be parsed (you'll see a spinning indicator)
4. Once complete, the file name will appear in the upload area

#### Option B: Paste Text

1. Scroll down to the text area below the upload zone
2. Paste your offer text directly into the field
3. You can also manually type or edit the text

### Step 3: Add Additional Notes (Optional)

Below the main offer text, there's an **"Additional Notes"** field where you can:

- Specify focus areas (e.g., "Focus on e-commerce functionality")
- Add context not in the offer (e.g., "Client prefers WordPress")
- Request specific task types (e.g., "Include detailed QA tasks")
- Mention constraints (e.g., "Tight deadline, prioritize MVP features")

### Step 4: Generate Tasks

1. Click the **"Generate Tasks"** button
2. Wait for the AI to process (typically 10-20 seconds)
3. A loading indicator will show progress
4. Once complete, tasks will appear in the right panel

### Understanding Generated Results

After generation, you'll see:

#### Summary Card
- **Total tasks**: Number of tasks generated
- **Epics**: Large feature/phase groupings
- **Stories/Tasks**: Individual work items

#### Recommendations
Yellow box with AI suggestions for the project, such as:
- Suggested additional phases
- Risk warnings
- Timeline considerations

#### Task List
Each task shows:
- **Checkbox**: Select/deselect for export
- **Type badge**: Epic (purple), Story (green), Task (blue), Subtask (gray)
- **Summary**: Task title
- **Priority badge**: Highest, High, Medium, Low, Lowest

### Editing Tasks

Click on any task to expand it and edit:

1. **Summary**: Edit the task title
2. **Description**: Modify the description (includes acceptance criteria)
3. **Type**: Change between Epic, Story, Task, Subtask
4. **Priority**: Adjust priority level
5. **Labels**: Edit comma-separated labels

### Selecting Tasks for Export

- **Select All**: Click "Select all" to check all tasks
- **Deselect All**: Click "Deselect all" to uncheck all tasks
- **Individual Selection**: Click the checkbox next to each task
- Selected tasks show a blue border and checkmark

### Saving Your Work

- **Save**: Click "Save" to store the generation in History
- **Template**: Click "Template" to save as a reusable template

---

## 4. History Tab

The History tab stores all your saved task generations.

### Viewing History

1. Click the **"History"** tab
2. Browse saved generations displayed as cards
3. Each card shows:
   - Project name
   - Date created
   - Number of tasks
   - Brief excerpt

### Loading from History

1. Find the generation you want to use
2. Click the **"Load"** button
3. You'll be taken to the Generate tab with all tasks loaded
4. You can edit, add, or remove tasks as needed

### Deleting History Items

1. Click the trash icon on any history card
2. The item will be permanently deleted

---

## 5. Templates Tab

Templates let you save and reuse task structures across similar projects.

### Creating a Template

1. Generate tasks in the Generate tab
2. Click the **"Template"** button in the summary card
3. Enter a template name (e.g., "E-commerce Website Standard")
4. Click **"Save"**

### Using a Template

1. Go to the **"Templates"** tab
2. Find your desired template
3. Click **"Use Template"**
4. Tasks will load into the Generate tab
5. Edit as needed for your specific project

### Template Best Practices

- Create templates for common project types:
  - Corporate website
  - E-commerce store
  - Web application
  - Mobile app
- Name templates descriptively
- Update templates as your processes evolve

---

## 6. Exporting to Jira

### CSV Export

PM Helper exports tasks in Jira-compatible CSV format.

#### Export Steps

1. Select the tasks you want to export (use checkboxes)
2. In the "Export for Jira" section, you'll see the count of selected tasks
3. Choose your export method:
   - **Copy CSV**: Copies to clipboard (paste into spreadsheet)
   - **Download CSV**: Downloads a .csv file

#### CSV Columns

The exported CSV includes these Jira-compatible fields:

| Column | Description |
|--------|-------------|
| Summary | Task title |
| Description | Full description with acceptance criteria |
| Issue Type | Epic, Story, Task, or Subtask |
| Priority | Highest, High, Medium, Low, Lowest |
| Labels | Comma-separated labels |

### Importing into Jira

1. In Jira, go to your project
2. Click **"..."** (more options) > **"Import issues"**
3. Select **"CSV"** as the source
4. Upload your downloaded CSV file
5. Map the columns:
   - Summary → Summary
   - Description → Description
   - Issue Type → Issue Type
   - Priority → Priority
   - Labels → Labels
6. Complete the import wizard
7. Review imported issues

### Tips for Jira Import

- Ensure your Jira project has the issue types configured (Epic, Story, Task, Subtask)
- Check that priority levels match your Jira configuration
- Labels will be created automatically if they don't exist
- For subtasks, you may need to manually link them to parent tasks after import

---

## 7. Tips & Best Practices

### For Best AI Results

1. **Provide detailed offers**: More information = better task breakdown
2. **Include specifics**: Mention pages, features, integrations explicitly
3. **Use additional notes**: Guide the AI with context
4. **Review and edit**: AI output is a starting point, not final

### Workflow Recommendations

1. **Start with Generate**: Create initial task breakdown
2. **Review thoroughly**: Edit summaries and descriptions
3. **Adjust priorities**: Align with project priorities
4. **Select relevant tasks**: Uncheck tasks that don't apply
5. **Save to History**: Keep a record before exporting
6. **Export to Jira**: Import and assign to team members

### Task Organization

- **Epics** should represent major phases or features
- **Stories** should be user-facing functionality
- **Tasks** should be technical work items
- **Subtasks** should be smaller pieces of stories/tasks

### Labels to Use

The AI uses standard labels:

**Phase labels:**
- discovery, design, development, content, qa, launch

**Profile labels:**
- ux, ui, dev, pm, content, analytics

**Priority labels:**
- must-have, should-have, nice-to-have

---

## 8. Troubleshooting

### Common Issues

#### "Failed to generate tasks"

- Check your internet connection
- Try with a shorter offer text
- Wait a moment and try again
- Clear the form and start fresh

#### Document not parsing

- Ensure the file is a supported format (PDF, DOCX, TXT)
- Try copying text and pasting directly instead
- Check if the file is corrupted or password-protected

#### Tasks not appearing

- Generation can take 10-20 seconds
- Check for error messages
- Ensure offer text is at least 50 characters

#### CSV not importing to Jira

- Verify column headers match Jira fields
- Check issue types exist in your project
- Ensure no special characters are breaking the CSV

### Getting Help

If you encounter issues not covered here:

1. Check the browser console for error messages
2. Try refreshing the page
3. Contact the development team

---

## Quick Reference Card

| Action | How To |
|--------|--------|
| Upload offer | Drag & drop or click upload area |
| Change language | Click English/Slovenian buttons |
| Generate tasks | Click "Generate Tasks" button |
| Select all tasks | Click "Select all" link |
| Edit a task | Click on the task row to expand |
| Delete a task | Click trash icon on task row |
| Export to CSV | Click "Download CSV" button |
| Save to history | Click "Save" button |
| Create template | Click "Template" button |

---

**Document Version:** 1.0
**Last Updated:** January 2026
**Created for:** Renderspace Digital Agency

---

*PM Helper - Making project planning faster and smarter.*
