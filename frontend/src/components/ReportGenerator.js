// File: frontend/src/components/ReportGenerator.js
import React, { useState, useEffect } from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { 
  FileText, Download, Settings, Check, Calendar, 
  User, Users, MapPin, Network, Clock, Shield, AlertCircle,
  ChevronRight, Loader2, X
} from 'lucide-react';
import { peopleAPI, casesAPI, todosAPI, auditAPI, businessesAPI, locationsAPI } from '../utils/api';

const ReportGenerator = ({ caseId = null, personId = null, customPeopleIds = null, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportOptions, setReportOptions] = useState({
    includeSummary: true,
    includePeople: true,
    includeConnections: true,
    includeTimeline: true,
    includeLocations: true,
    includeOsintData: true,
    includeTodos: true,
    includeAuditLog: false,
    includeCharts: true,
    reportType: 'comprehensive',
    dateRange: 'all'
  });
  
  const [data, setData] = useState({
    cases: [],
    people: [],
    businesses: [],
    locations: [],
    todos: [],
    auditLogs: [],
    selectedCase: null,
    selectedPerson: null
  });

  useEffect(() => {
    fetchData();
  }, [caseId, personId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [casesData, peopleData, businessesData, locationsData, todosData] = await Promise.all([
        casesAPI.getAll(),
        peopleAPI.getAll(),
        businessesAPI.getAll(),
        locationsAPI.getAll(),
        todosAPI.getAll()
      ]);

      let auditLogs = [];
      if (reportOptions.includeAuditLog) {
        auditLogs = await auditAPI.getAll({ limit: 100 });
      }

      let filteredPeople = peopleData;
      let selectedCase = null;
      let selectedPerson = null;

      if (customPeopleIds && customPeopleIds.length > 0) {
        filteredPeople = peopleData.filter(p => customPeopleIds.includes(p.id));
      } else if (caseId) {
        selectedCase = casesData.find(c => c.id === caseId);
        filteredPeople = peopleData.filter(p => p.case_name === selectedCase?.case_name);
      } else if (personId) {
        selectedPerson = peopleData.find(p => p.id === personId);
        if (!caseId && selectedPerson?.case_name) {
          selectedCase = casesData.find(c => c.case_name === selectedPerson.case_name);
          filteredPeople = peopleData.filter(p => p.case_name === selectedPerson.case_name);
        }
      }

      setData({
        cases: casesData,
        people: filteredPeople,
        businesses: businessesData,
        locations: locationsData,
        todos: todosData,
        auditLogs,
        selectedCase,
        selectedPerson
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to fetch data for report');
    } finally {
      setLoading(false);
    }
  };

  const getFullName = (person) => {
    return `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown';
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const generateMarkdown = async () => {
    setGenerating(true);
    
    try {
      let markdown = '';
      
      // Title and Header
      markdown += `# 🔍 INVESTIGATION REPORT\n\n`;
      
      const reportTitle = data.selectedCase ? data.selectedCase.case_name : 
                         data.selectedPerson ? getFullName(data.selectedPerson) : "General Report";
      
      markdown += `## ${reportTitle}\n\n`;
      markdown += `**Generated:** ${formatDateTime(new Date())}  \n`;
      markdown += `**Report ID:** RPT-${Date.now()}  \n`;
      markdown += `**Classification:** 🔒 CONFIDENTIAL\n\n`;
      
      markdown += `---\n\n`;
      
      // Summary Statistics
      markdown += `## 📊 SUMMARY STATISTICS\n\n`;
      
      const totalConnections = data.people.reduce((sum, p) => sum + (p.connections?.length || 0), 0);
      const activeTasks = data.todos.filter(t => t.status !== 'done').length;
      
      markdown += `| Metric | Count |\n`;
      markdown += `|--------|-------|\n`;
      markdown += `| 👥 People | ${data.people.length} |\n`;
      markdown += `| 🏢 Businesses | ${data.businesses.length} |\n`;
      markdown += `| 📍 Locations | ${data.locations.length} |\n`;
      markdown += `| 🔗 Connections | ${totalConnections} |\n`;
      markdown += `| ✅ Active Tasks | ${activeTasks} |\n\n`;
      
      // Executive Summary
      if (reportOptions.includeSummary) {
        markdown += `## 📋 EXECUTIVE SUMMARY\n\n`;
        
        if (data.selectedCase) {
          markdown += `This report covers the investigation case **"${data.selectedCase.case_name}"**.  \n`;
          markdown += `**Status:** ${data.selectedCase.status || 'Active'}  \n\n`;
          markdown += `The case involves ${data.people.length} individuals with ${totalConnections} documented connections.\n\n`;
        } else {
          markdown += `This comprehensive report includes ${data.people.length} individuals and ${totalConnections} documented relationships.\n\n`;
        }
        
        // Key insights
        markdown += `### 🎯 Key Insights\n\n`;
        
        if (data.people.length > 0) {
          const categories = [...new Set(data.people.map(p => p.category).filter(Boolean))];
          markdown += `- **${categories.length}** different person categories tracked\n`;
        }
        
        if (totalConnections > 0) {
          const avgConnections = (totalConnections / data.people.length).toFixed(1);
          markdown += `- **${avgConnections}** average connections per person\n`;
        }
        
        if (data.businesses.length > 0) {
          markdown += `- **${data.businesses.length}** business entities in scope\n`;
        }
        
        markdown += `\n`;
      }
      
      // People Profiles
      if (reportOptions.includePeople && data.people.length > 0) {
        markdown += `## 👥 PEOPLE PROFILES\n\n`;
        
        // People summary table
        markdown += `### Overview\n\n`;
        markdown += `| Name | Category | Status | Connections | Case |\n`;
        markdown += `|------|----------|--------|-------------| ---- |\n`;
        
        data.people.forEach(person => {
          const name = getFullName(person);
          const category = person.category || 'N/A';
          const status = person.status || 'N/A';
          const connections = person.connections?.length || 0;
          const caseName = person.case_name || 'N/A';
          markdown += `| ${name} | ${category} | ${status} | ${connections} | ${caseName} |\n`;
        });
        
        markdown += `\n### Detailed Profiles\n\n`;
        
        data.people.forEach((person, index) => {
          markdown += `#### ${index + 1}. ${getFullName(person)}\n\n`;
          
          markdown += `**Basic Information:**\n`;
          markdown += `- **Category:** ${person.category || 'N/A'}\n`;
          markdown += `- **Status:** ${person.status || 'N/A'}\n`;
          markdown += `- **Case:** ${person.case_name || 'N/A'}\n`;
          
          if (person.date_of_birth) {
            markdown += `- **Date of Birth:** ${formatDate(person.date_of_birth)}\n`;
          }
          
          if (person.aliases && person.aliases.length > 0) {
            markdown += `- **Known Aliases:** ${person.aliases.join(', ')}\n`;
          }
          
          markdown += `- **Connections:** ${person.connections?.length || 0}\n\n`;
          
          if (person.notes) {
            markdown += `**Notes:**\n`;
            markdown += `> ${person.notes}\n\n`;
          }
        });
      }
      
      // Business Profiles
      if (data.businesses.length > 0) {
        markdown += `## 🏢 BUSINESS PROFILES\n\n`;
        
        // Business summary table
        markdown += `| Name | Industry | Address | Website |\n`;
        markdown += `|------|----------|---------|----------|\n`;
        
        data.businesses.forEach(business => {
          const name = business.name || 'Unknown';
          const industry = business.industry || 'N/A';
          const address = business.address || 'N/A';
          const website = business.website || 'N/A';
          markdown += `| ${name} | ${industry} | ${address} | ${website} |\n`;
        });
        
        markdown += `\n### Detailed Business Information\n\n`;
        
        data.businesses.forEach((business, index) => {
          markdown += `#### ${index + 1}. ${business.name || 'Unknown Business'}\n\n`;
          
          if (business.industry) {
            markdown += `**Industry:** ${business.industry}  \n`;
          }
          
          if (business.address) {
            markdown += `**Address:** ${business.address}  \n`;
          }
          
          if (business.website) {
            markdown += `**Website:** [${business.website}](${business.website})  \n`;
          }
          
          if (business.description) {
            markdown += `\n**Description:**\n`;
            markdown += `${business.description}\n\n`;
          } else {
            markdown += `\n`;
          }
        });
      }
      
      // Connections Analysis
      if (reportOptions.includeConnections && totalConnections > 0) {
        markdown += `## 🔗 CONNECTIONS ANALYSIS\n\n`;
        
        markdown += `**Total Documented Connections:** ${totalConnections}\n\n`;
        
        // Connection matrix
        markdown += `### Connection Details\n\n`;
        markdown += `| From | To | Relationship | Notes |\n`;
        markdown += `|------|----|--------------| ----- |\n`;
        
        data.people.forEach(person => {
          if (person.connections && person.connections.length > 0) {
            person.connections.forEach(conn => {
              const targetPerson = data.people.find(p => p.id === conn.person_id);
              if (targetPerson) {
                const fromName = getFullName(person);
                const toName = getFullName(targetPerson);
                const type = conn.type || 'Unknown';
                const note = conn.note || '';
                markdown += `| ${fromName} | ${toName} | ${type} | ${note} |\n`;
              }
            });
          }
        });
        
        markdown += `\n`;
      }
      
      // Location Analysis
      if (reportOptions.includeLocations && data.locations.length > 0) {
        markdown += `## 📍 LOCATION ANALYSIS\n\n`;
        
        markdown += `**Total Locations Tracked:** ${data.locations.length}\n\n`;
        
        // Group locations by type
        const locationsByType = {};
        data.locations.forEach(loc => {
          const type = loc.type || 'Unknown';
          if (!locationsByType[type]) {
            locationsByType[type] = [];
          }
          locationsByType[type].push(loc);
        });
        
        Object.entries(locationsByType).forEach(([type, locations]) => {
          markdown += `### ${type} (${locations.length} locations)\n\n`;
          
          markdown += `| Location | Coordinates | Details |\n`;
          markdown += `|----------|-------------|----------|\n`;
          
          locations.slice(0, 10).forEach(location => {
            const name = location.address || location.name || 'Unknown Location';
            const coords = location.coordinates ? `${location.coordinates.lat}, ${location.coordinates.lng}` : 'N/A';
            const details = location.description || '';
            markdown += `| ${name} | ${coords} | ${details} |\n`;
          });
          
          if (locations.length > 10) {
            markdown += `\n*... and ${locations.length - 10} more locations*\n`;
          }
          
          markdown += `\n`;
        });
      }
      
      // Tasks/Todos
      if (reportOptions.includeTodos && data.todos.length > 0) {
        markdown += `## ✅ INVESTIGATION TASKS\n\n`;
        
        const openTodos = data.todos.filter(t => t.status === 'open').length;
        const inProgressTodos = data.todos.filter(t => t.status === 'in_progress').length;
        const doneTodos = data.todos.filter(t => t.status === 'done').length;
        
        markdown += `**Task Summary:** Open: ${openTodos} | In Progress: ${inProgressTodos} | Completed: ${doneTodos}\n\n`;
        
        // Task breakdown by status
        const tasksByStatus = {
          'open': data.todos.filter(t => t.status === 'open'),
          'in_progress': data.todos.filter(t => t.status === 'in_progress'),
          'done': data.todos.filter(t => t.status === 'done')
        };
        
        Object.entries(tasksByStatus).forEach(([status, tasks]) => {
          if (tasks.length === 0) return;
          
          const statusEmoji = status === 'done' ? '✅' : status === 'in_progress' ? '🔄' : '📋';
          markdown += `### ${statusEmoji} ${status.replace('_', ' ').toUpperCase()} (${tasks.length})\n\n`;
          
          tasks.forEach((todo, idx) => {
            markdown += `${idx + 1}. **${todo.text}**  \n`;
            markdown += `   *Created: ${formatDate(todo.created_at)}*\n\n`;
          });
        });
      }
      
      // Statistical Analysis
      if (reportOptions.includeCharts) {
        markdown += `## 📈 STATISTICAL ANALYSIS\n\n`;
        
        // People by category breakdown
        const peopleByCategory = {};
        data.people.forEach(person => {
          const category = person.category || 'Unknown';
          peopleByCategory[category] = (peopleByCategory[category] || 0) + 1;
        });
        
        markdown += `### People by Category\n\n`;
        markdown += `| Category | Count | Percentage |\n`;
        markdown += `|----------|-------|------------|\n`;
        
        Object.entries(peopleByCategory).forEach(([category, count]) => {
          const percentage = ((count / data.people.length) * 100).toFixed(1);
          markdown += `| ${category} | ${count} | ${percentage}% |\n`;
        });
        
        markdown += `\n`;
        
        // Task completion analysis
        if (data.todos.length > 0) {
          const openTodos = data.todos.filter(t => t.status === 'open').length;
          const inProgressTodos = data.todos.filter(t => t.status === 'in_progress').length;
          const doneTodos = data.todos.filter(t => t.status === 'done').length;
          
          const completionRate = ((doneTodos / data.todos.length) * 100).toFixed(1);
          
          markdown += `### Task Progress\n\n`;
          markdown += `**Overall Completion Rate:** ${completionRate}%\n\n`;
          
          markdown += `\`\`\`\n`;
          markdown += `Task Distribution:\n`;
          markdown += `├─ Open: ${openTodos} (${((openTodos / data.todos.length) * 100).toFixed(1)}%)\n`;
          markdown += `├─ In Progress: ${inProgressTodos} (${((inProgressTodos / data.todos.length) * 100).toFixed(1)}%)\n`;
          markdown += `└─ Completed: ${doneTodos} (${((doneTodos / data.todos.length) * 100).toFixed(1)}%)\n`;
          markdown += `\`\`\`\n\n`;
        }
        
        // Network analysis
        if (totalConnections > 0) {
          markdown += `### Network Analysis\n\n`;
          
          const avgConnections = (totalConnections / data.people.length).toFixed(2);
          markdown += `**Average connections per person:** ${avgConnections}\n\n`;
          
          const mostConnected = data.people
            .map(p => ({ name: getFullName(p), connections: p.connections?.length || 0 }))
            .sort((a, b) => b.connections - a.connections)
            .slice(0, 5);
          
          markdown += `**Most Connected Individuals:**\n\n`;
          mostConnected.forEach((person, idx) => {
            markdown += `${idx + 1}. **${person.name}** - ${person.connections} connections\n`;
          });
          
          markdown += `\n`;
        }
      }
      
      // Report Footer
      markdown += `---\n\n`;
      markdown += `## 📄 REPORT INFORMATION\n\n`;
      markdown += `**Generated By:** GHOST OSINT Investigation CRM  \n`;
      markdown += `**Generation Date:** ${formatDateTime(new Date())}  \n`;
      markdown += `**Report ID:** RPT-${Date.now()}  \n`;
      markdown += `**Classification:** 🔒 CONFIDENTIAL\n\n`;
      markdown += `> This report contains confidential information and is intended solely for authorized personnel.\n\n`;
      markdown += `---\n`;
      markdown += `*End of Report*`;
      
      // Create and download the markdown file
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const filename = `investigation-report-${Date.now()}.md`;
      saveAs(blob, filename);
      
      alert('Markdown report generated successfully! The file has been downloaded.');
      
    } catch (error) {
      console.error('Error generating Markdown document:', error);
      alert('Failed to generate Markdown document. Error: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const generateWord = async () => {
    setGenerating(true);
    
    try {
      // Create a very simple document structure
      const children = [];

      // Title
      children.push(
        new Paragraph({
          text: "INVESTIGATION REPORT",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER
        })
      );

      // Subtitle
      const reportTitle = data.selectedCase ? data.selectedCase.case_name : 
                         data.selectedPerson ? getFullName(data.selectedPerson) : "General Report";
      
      children.push(
        new Paragraph({
          text: reportTitle,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER
        })
      );

      // Generation date
      children.push(
        new Paragraph({
          text: `Generated: ${formatDateTime(new Date())}`,
          alignment: AlignmentType.CENTER
        })
      );

      // Empty line
      children.push(new Paragraph({ text: "" }));

      // Summary information
      children.push(
        new Paragraph({
          text: "SUMMARY STATISTICS",
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER
        })
      );

      children.push(
        new Paragraph({
          text: `Total People: ${data.people.length}`,
        })
      );

      children.push(
        new Paragraph({
          text: `Total Businesses: ${data.businesses.length}`,
        })
      );

      children.push(
        new Paragraph({
          text: `Total Locations: ${data.locations.length}`,
        })
      );

      const totalConnections = data.people.reduce((sum, p) => sum + (p.connections?.length || 0), 0);
      children.push(
        new Paragraph({
          text: `Total Connections: ${totalConnections}`,
        })
      );

      children.push(
        new Paragraph({
          text: `Active Tasks: ${data.todos.filter(t => t.status !== 'done').length}`,
        })
      );

      // Empty line
      children.push(new Paragraph({ text: "" }));

      // Executive Summary
      if (reportOptions.includeSummary) {
        children.push(
          new Paragraph({
            text: "Executive Summary",
            heading: HeadingLevel.HEADING_1
          })
        );

        if (data.selectedCase) {
          children.push(
            new Paragraph({
              text: `This report covers the investigation case "${data.selectedCase.case_name}".`
            })
          );
          
          children.push(
            new Paragraph({
              text: `Status: ${data.selectedCase.status || 'Active'}`
            })
          );

          children.push(
            new Paragraph({
              text: `The case involves ${data.people.length} individuals with ${totalConnections} documented connections.`
            })
          );
        } else {
          children.push(
            new Paragraph({
              text: `This comprehensive report includes ${data.people.length} individuals and ${totalConnections} documented relationships.`
            })
          );
        }

        children.push(new Paragraph({ text: "" }));
      }

      // People Profiles
      if (reportOptions.includePeople && data.people.length > 0) {
        children.push(
          new Paragraph({
            text: "People Profiles",
            heading: HeadingLevel.HEADING_1
          })
        );

        data.people.forEach((person, index) => {
          children.push(
            new Paragraph({
              text: `${index + 1}. ${getFullName(person)}`,
              heading: HeadingLevel.HEADING_2
            })
          );

          children.push(
            new Paragraph({
              text: `Category: ${person.category || 'N/A'}`
            })
          );

          children.push(
            new Paragraph({
              text: `Status: ${person.status || 'N/A'}`
            })
          );

          children.push(
            new Paragraph({
              text: `Case: ${person.case_name || 'N/A'}`
            })
          );

          if (person.date_of_birth) {
            children.push(
              new Paragraph({
                text: `Date of Birth: ${formatDate(person.date_of_birth)}`
              })
            );
          }

          children.push(
            new Paragraph({
              text: `Connections: ${person.connections?.length || 0}`
            })
          );

          if (person.aliases && person.aliases.length > 0) {
            children.push(
              new Paragraph({
                text: `Known Aliases: ${person.aliases.join(', ')}`
              })
            );
          }

          if (person.notes) {
            children.push(
              new Paragraph({
                text: "Notes:"
              })
            );
            
            children.push(
              new Paragraph({
                text: person.notes
              })
            );
          }

          children.push(new Paragraph({ text: "" }));
        });
      }

      // Connections Analysis
      if (reportOptions.includeConnections && totalConnections > 0) {
        children.push(
          new Paragraph({
            text: "Connections Analysis",
            heading: HeadingLevel.HEADING_1
          })
        );

        children.push(
          new Paragraph({
            text: `Total Documented Connections: ${totalConnections}`
          })
        );

        let connectionIndex = 1;
        data.people.forEach(person => {
          if (person.connections && person.connections.length > 0) {
            person.connections.forEach(conn => {
              const targetPerson = data.people.find(p => p.id === conn.person_id);
              if (targetPerson) {
                children.push(
                  new Paragraph({
                    text: `${connectionIndex}. ${getFullName(person)} -> ${getFullName(targetPerson)}`
                  })
                );

                children.push(
                  new Paragraph({
                    text: `   Type: ${conn.type || 'Unknown'}${conn.note ? ' | Note: ' + conn.note : ''}`
                  })
                );

                connectionIndex++;
              }
            });
          }
        });

        children.push(new Paragraph({ text: "" }));
      }

      // Business Profiles  
      if (data.businesses.length > 0) {
        children.push(
          new Paragraph({
            text: "Business Profiles",
            heading: HeadingLevel.HEADING_1
          })
        );

        data.businesses.forEach((business, index) => {
          children.push(
            new Paragraph({
              text: `${index + 1}. ${business.name || 'Unknown Business'}`,
              heading: HeadingLevel.HEADING_2
            })
          );

          if (business.industry) {
            children.push(
              new Paragraph({
                text: `Industry: ${business.industry}`
              })
            );
          }

          if (business.address) {
            children.push(
              new Paragraph({
                text: `Address: ${business.address}`
              })
            );
          }

          if (business.website) {
            children.push(
              new Paragraph({
                text: `Website: ${business.website}`
              })
            );
          }

          if (business.description) {
            children.push(
              new Paragraph({
                text: "Description:"
              })
            );
            
            children.push(
              new Paragraph({
                text: business.description
              })
            );
          }

          children.push(new Paragraph({ text: "" }));
        });
      }

      // Location Analysis
      if (reportOptions.includeLocations && data.locations.length > 0) {
        children.push(
          new Paragraph({
            text: "Location Analysis",
            heading: HeadingLevel.HEADING_1
          })
        );

        children.push(
          new Paragraph({
            text: `Total Locations Tracked: ${data.locations.length}`
          })
        );

        // Group locations by type if available
        const locationsByType = {};
        data.locations.forEach(loc => {
          const type = loc.type || 'Unknown';
          if (!locationsByType[type]) {
            locationsByType[type] = [];
          }
          locationsByType[type].push(loc);
        });

        Object.entries(locationsByType).forEach(([type, locations]) => {
          children.push(
            new Paragraph({
              text: `${type}: ${locations.length} locations`,
              heading: HeadingLevel.HEADING_2
            })
          );

          locations.slice(0, 10).forEach((location, idx) => {
            children.push(
              new Paragraph({
                text: `   ${idx + 1}. ${location.address || location.name || 'Unknown Location'}`
              })
            );

            if (location.coordinates) {
              children.push(
                new Paragraph({
                  text: `      Coordinates: ${location.coordinates.lat}, ${location.coordinates.lng}`
                })
              );
            }
          });

          if (locations.length > 10) {
            children.push(
              new Paragraph({
                text: `   ... and ${locations.length - 10} more locations`
              })
            );
          }

          children.push(new Paragraph({ text: "" }));
        });
      }

      // Tasks/Todos
      if (reportOptions.includeTodos && data.todos.length > 0) {
        children.push(
          new Paragraph({
            text: "Investigation Tasks",
            heading: HeadingLevel.HEADING_1
          })
        );

        const openTodos = data.todos.filter(t => t.status === 'open').length;
        const inProgressTodos = data.todos.filter(t => t.status === 'in_progress').length;
        const doneTodos = data.todos.filter(t => t.status === 'done').length;

        children.push(
          new Paragraph({
            text: `Open: ${openTodos} | In Progress: ${inProgressTodos} | Completed: ${doneTodos}`
          })
        );

        data.todos.forEach((todo, idx) => {
          children.push(
            new Paragraph({
              text: `${idx + 1}. ${todo.text}`
            })
          );

          children.push(
            new Paragraph({
              text: `   Status: ${(todo.status || 'unknown').replace('_', ' ').toUpperCase()} | Created: ${formatDate(todo.created_at)}`
            })
          );
        });

        children.push(new Paragraph({ text: "" }));
      }

      // Statistical Analysis
      if (reportOptions.includeCharts) {
        children.push(
          new Paragraph({
            text: "Statistical Analysis",
            heading: HeadingLevel.HEADING_1
          })
        );

        // People by category breakdown
        const peopleByCategory = {};
        data.people.forEach(person => {
          const category = person.category || 'Unknown';
          peopleByCategory[category] = (peopleByCategory[category] || 0) + 1;
        });

        children.push(
          new Paragraph({
            text: "People by Category:",
            heading: HeadingLevel.HEADING_2
          })
        );

        Object.entries(peopleByCategory).forEach(([category, count]) => {
          const percentage = ((count / data.people.length) * 100).toFixed(1);
          children.push(
            new Paragraph({
              text: `   ${category}: ${count} (${percentage}%)`
            })
          );
        });

        children.push(new Paragraph({ text: "" }));

        // Task completion analysis
        if (data.todos.length > 0) {
          const todosByStatus = {
            'open': data.todos.filter(t => t.status === 'open').length,
            'in_progress': data.todos.filter(t => t.status === 'in_progress').length,
            'done': data.todos.filter(t => t.status === 'done').length
          };

          children.push(
            new Paragraph({
              text: "Task Progress:",
              heading: HeadingLevel.HEADING_2
            })
          );

          const completionRate = ((todosByStatus.done / data.todos.length) * 100).toFixed(1);
          children.push(
            new Paragraph({
              text: `Overall Completion Rate: ${completionRate}%`
            })
          );

          Object.entries(todosByStatus).forEach(([status, count]) => {
            const percentage = ((count / data.todos.length) * 100).toFixed(1);
            children.push(
              new Paragraph({
                text: `   ${status.replace('_', ' ').toUpperCase()}: ${count} (${percentage}%)`
              })
            );
          });

          children.push(new Paragraph({ text: "" }));
        }

        // Connection density analysis
        if (totalConnections > 0) {
          children.push(
            new Paragraph({
              text: "Network Analysis:",
              heading: HeadingLevel.HEADING_2
            })
          );

          const avgConnections = (totalConnections / data.people.length).toFixed(2);
          children.push(
            new Paragraph({
              text: `Average connections per person: ${avgConnections}`
            })
          );

          const mostConnected = data.people
            .map(p => ({ name: getFullName(p), connections: p.connections?.length || 0 }))
            .sort((a, b) => b.connections - a.connections)
            .slice(0, 5);

          children.push(
            new Paragraph({
              text: "Most Connected Individuals:"
            })
          );

          mostConnected.forEach((person, idx) => {
            children.push(
              new Paragraph({
                text: `   ${idx + 1}. ${person.name}: ${person.connections} connections`
              })
            );
          });

          children.push(new Paragraph({ text: "" }));
        }
      }

      // Report Footer
      children.push(
        new Paragraph({
          text: "Report Information",
          heading: HeadingLevel.HEADING_1
        })
      );

      children.push(
        new Paragraph({
          text: "Generated By: GHOST OSINT Investigation CRM"
        })
      );

      children.push(
        new Paragraph({
          text: `Generation Date: ${formatDateTime(new Date())}`
        })
      );

      children.push(
        new Paragraph({
          text: `Report ID: RPT-${Date.now()}`
        })
      );

      children.push(
        new Paragraph({
          text: "Classification: CONFIDENTIAL"
        })
      );

      children.push(
        new Paragraph({
          text: "This report contains confidential information and is intended solely for authorized personnel."
        })
      );

      children.push(
        new Paragraph({
          text: "End of Report",
          alignment: AlignmentType.CENTER
        })
      );

      // Create the document with minimal structure
      const doc = new Document({
        sections: [{
          children: children
        }]
      });

      // Generate and save the document
      const blob = await Packer.toBlob(doc);
      const filename = `investigation-report-${Date.now()}.docx`;
      saveAs(blob, filename);
      
      alert('Report generated successfully! The Word document has been downloaded.');
      
    } catch (error) {
      console.error('Error generating Word document:', error);
      alert('Failed to generate Word document. Error: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">Generate Investigation Report</h2>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        {loading ? (
          <div className="p-6 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2">Loading data...</span>
          </div>
        ) : (
          <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column - Report Options */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Report Options
                </h3>
                
                {/* Report Type */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
                  <select
                    value={reportOptions.reportType}
                    onChange={(e) => setReportOptions({ ...reportOptions, reportType: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="comprehensive">Comprehensive Report</option>
                    <option value="summary">Executive Summary</option>
                    <option value="person-profile">Person Profile</option>
                  </select>
                </div>
                
                {/* Date Range */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                  <select
                    value={reportOptions.dateRange}
                    onChange={(e) => setReportOptions({ ...reportOptions, dateRange: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="all">All Time</option>
                    <option value="last-week">Last Week</option>
                    <option value="last-month">Last Month</option>
                    <option value="last-year">Last Year</option>
                  </select>
                </div>
                
                {/* Include Options */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Include in Report:</label>
                  
                  {[
                    { key: 'includeSummary', label: 'Executive Summary', icon: FileText },
                    { key: 'includePeople', label: 'People Profiles', icon: Users },
                    { key: 'includeConnections', label: 'Connections Network', icon: Network },
                    { key: 'includeTimeline', label: 'Timeline', icon: Clock },
                    { key: 'includeLocations', label: 'Locations', icon: MapPin },
                    { key: 'includeOsintData', label: 'OSINT Data', icon: Shield },
                    { key: 'includeTodos', label: 'Tasks/Todos', icon: Check },
                    { key: 'includeAuditLog', label: 'Audit Trail', icon: AlertCircle },
                    { key: 'includeCharts', label: 'Charts & Analytics', icon: FileText }
                  ].map(({ key, label, icon: Icon }) => (
                    <label key={key} className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reportOptions[key]}
                        onChange={(e) => setReportOptions({ ...reportOptions, [key]: e.target.checked })}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <Icon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Right Column - Preview */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Report Preview</h3>
                
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Report Scope:</span>
                    <span className="text-sm text-gray-600">
                      {data.selectedCase ? `Case: ${data.selectedCase.case_name}` : 
                       data.selectedPerson ? `Person: ${getFullName(data.selectedPerson)}` :
                       'All Data'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="font-medium">People Included:</span>
                    <span className="text-sm text-gray-600">{data.people.length}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total Connections:</span>
                    <span className="text-sm text-gray-600">
                      {data.people.reduce((sum, p) => sum + (p.connections?.length || 0), 0)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Export Formats:</span>
                    <span className="text-sm text-gray-600">Markdown (.md) | Word (.docx)</span>
                  </div>
                </div>
                
                {/* Sections to be included */}
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Report Structure:</h4>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <ChevronRight className="w-4 h-4 mr-1 text-gray-400" />
                      Cover Page
                    </div>
                    {reportOptions.includeSummary && (
                      <div className="flex items-center text-sm">
                        <ChevronRight className="w-4 h-4 mr-1 text-gray-400" />
                        Executive Summary
                      </div>
                    )}
                    {reportOptions.includePeople && (
                      <div className="flex items-center text-sm">
                        <ChevronRight className="w-4 h-4 mr-1 text-gray-400" />
                        People Profiles ({data.people.length} profiles)
                      </div>
                    )}
                    {reportOptions.includeConnections && (
                      <div className="flex items-center text-sm">
                        <ChevronRight className="w-4 h-4 mr-1 text-gray-400" />
                        Connections Analysis
                      </div>
                    )}
                    {reportOptions.includeLocations && (
                      <div className="flex items-center text-sm">
                        <ChevronRight className="w-4 h-4 mr-1 text-gray-400" />
                        Location Data
                      </div>
                    )}
                    {reportOptions.includeOsintData && (
                      <div className="flex items-center text-sm">
                        <ChevronRight className="w-4 h-4 mr-1 text-gray-400" />
                        OSINT Intelligence
                      </div>
                    )}
                    {reportOptions.includeTodos && (
                      <div className="flex items-center text-sm">
                        <ChevronRight className="w-4 h-4 mr-1 text-gray-400" />
                        Investigation Tasks
                      </div>
                    )}
                    {reportOptions.includeAuditLog && (
                      <div className="flex items-center text-sm">
                        <ChevronRight className="w-4 h-4 mr-1 text-gray-400" />
                        Activity Timeline
                      </div>
                    )}
                    {reportOptions.includeCharts && (
                      <div className="flex items-center text-sm">
                        <ChevronRight className="w-4 h-4 mr-1 text-gray-400" />
                        Statistical Analysis
                      </div>
                    )}
                    <div className="flex items-center text-sm">
                      <ChevronRight className="w-4 h-4 mr-1 text-gray-400" />
                      Report Information
                    </div>
                  </div>
                </div>

                {/* Note about simplified format */}
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Enhanced Reports:</strong> Choose between rich Markdown format (.md) with tables and formatting, or simplified Word format (.docx) for maximum compatibility.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="p-6 border-t flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // Show user choice between formats
              if (window.confirm('Choose format:\nOK = Markdown (.md) with rich formatting\nCancel = Word (.docx) for compatibility')) {
                generateMarkdown();
              } else {
                generateWord();
              }
            }}
            disabled={generating || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportGenerator;