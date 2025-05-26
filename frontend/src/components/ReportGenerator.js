// File: frontend/src/components/ReportGenerator.js
import React, { useState, useEffect } from 'react';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, BorderStyle, WidthType, Header, Footer, PageBreak, UnderlineType } from 'docx';
import { saveAs } from 'file-saver';
import { 
  FileText, Download, Settings, Check, Calendar, 
  User, Users, MapPin, Network, Clock, Shield, AlertCircle,
  ChevronRight, Loader2, X
} from 'lucide-react';
import { peopleAPI, casesAPI, modelOptionsAPI, customFieldsAPI, todosAPI, auditAPI } from '../utils/api';

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
    reportType: 'comprehensive', // 'comprehensive', 'summary', 'person-profile'
    dateRange: 'all' // 'all', 'last-week', 'last-month', 'last-year'
  });
  
  const [data, setData] = useState({
    cases: [],
    people: [],
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
      // Fetch all necessary data
      const [casesData, peopleData, todosData] = await Promise.all([
        casesAPI.getAll(),
        peopleAPI.getAll(),
        todosAPI.getAll()
      ]);

      let auditLogs = [];
      if (reportOptions.includeAuditLog) {
        auditLogs = await auditAPI.getAll({ limit: 100 });
      }

      // Filter data based on case, person, or custom IDs
      let filteredPeople = peopleData;
      let selectedCase = null;
      let selectedPerson = null;

      // Handle custom people IDs (from advanced search)
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

  const generateWord = async () => {
    setGenerating(true);
    
    try {
      const sections = [];

      // Title Page Section
      const titleSection = {
        properties: {},
        children: [
          new Paragraph({
            text: "INVESTIGATION REPORT",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            style: "Title"
          }),
          new Paragraph({
            text: data.selectedCase ? data.selectedCase.case_name : 
                  data.selectedPerson ? getFullName(data.selectedPerson) : "General Report",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 }
          }),
          new Paragraph({
            text: `Generated: ${formatDateTime(new Date())}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 800 }
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Report Type: ",
                bold: true
              }),
              new TextRun({
                text: reportOptions.reportType.charAt(0).toUpperCase() + reportOptions.reportType.slice(1)
              })
            ],
            spacing: { after: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Total People: ",
                bold: true
              }),
              new TextRun({
                text: data.people.length.toString()
              })
            ],
            spacing: { after: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Total Connections: ",
                bold: true
              }),
              new TextRun({
                text: data.people.reduce((sum, p) => sum + (p.connections?.length || 0), 0).toString()
              })
            ],
            spacing: { after: 200 }
          }),
          new PageBreak()
        ]
      };
      sections.push(titleSection);

      // Executive Summary
      if (reportOptions.includeSummary) {
        const summaryChildren = [
          new Paragraph({
            text: "Executive Summary",
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 300 }
          })
        ];

        if (data.selectedCase) {
          summaryChildren.push(
            new Paragraph({
              text: `This report covers the investigation case "${data.selectedCase.case_name}".`,
              spacing: { after: 200 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Status: ", bold: true }),
                new TextRun({ text: data.selectedCase.status || 'Active' })
              ],
              spacing: { after: 200 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Created: ", bold: true }),
                new TextRun({ text: formatDate(data.selectedCase.created_at) })
              ],
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: `The case involves ${data.people.length} individuals with ${data.people.reduce((sum, p) => sum + (p.connections?.length || 0), 0)} documented connections.`,
              spacing: { after: 200 }
            })
          );
          
          if (data.selectedCase.description) {
            summaryChildren.push(
              new Paragraph({
                text: "Case Description:",
                bold: true,
                spacing: { after: 100 }
              }),
              new Paragraph({
                text: data.selectedCase.description,
                spacing: { after: 200 }
              })
            );
          }
        } else if (data.selectedPerson) {
          summaryChildren.push(
            new Paragraph({
              text: `This report focuses on ${getFullName(data.selectedPerson)}.`,
              spacing: { after: 200 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Category: ", bold: true }),
                new TextRun({ text: data.selectedPerson.category || 'N/A' })
              ],
              spacing: { after: 200 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Status: ", bold: true }),
                new TextRun({ text: data.selectedPerson.status || 'N/A' })
              ],
              spacing: { after: 200 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Connections: ", bold: true }),
                new TextRun({ text: (data.selectedPerson.connections?.length || 0).toString() })
              ],
              spacing: { after: 200 }
            })
          );
        }

        summaryChildren.push(new PageBreak());
        sections.push({ children: summaryChildren });
      }

      // People Profiles
      if (reportOptions.includePeople && data.people.length > 0) {
        const peopleChildren = [
          new Paragraph({
            text: "People Profiles",
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 300 }
          })
        ];

        data.people.forEach((person, index) => {
          peopleChildren.push(
            new Paragraph({
              text: `${index + 1}. ${getFullName(person)}`,
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 }
            })
          );

          // Basic info table
          const infoRows = [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: "Category", bold: true })],
                  width: { size: 30, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                  children: [new Paragraph({ text: person.category || 'N/A' })],
                  width: { size: 70, type: WidthType.PERCENTAGE }
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: "Status", bold: true })]
                }),
                new TableCell({
                  children: [new Paragraph({ text: person.status || 'N/A' })]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: "Case", bold: true })]
                }),
                new TableCell({
                  children: [new Paragraph({ text: person.case_name || 'N/A' })]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: "CRM Status", bold: true })]
                }),
                new TableCell({
                  children: [new Paragraph({ text: person.crm_status || 'N/A' })]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: "Connections", bold: true })]
                }),
                new TableCell({
                  children: [new Paragraph({ text: (person.connections?.length || 0).toString() })]
                })
              ]
            })
          ];

          if (person.date_of_birth) {
            infoRows.splice(2, 0, new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: "Date of Birth", bold: true })]
                }),
                new TableCell({
                  children: [new Paragraph({ text: formatDate(person.date_of_birth) })]
                })
              ]
            }));
          }

          peopleChildren.push(
            new Table({
              rows: infoRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
              margins: { bottom: 200 }
            })
          );

          if (person.aliases && person.aliases.length > 0) {
            peopleChildren.push(
              new Paragraph({
                children: [
                  new TextRun({ text: "Aliases: ", bold: true }),
                  new TextRun({ text: person.aliases.join(', '), italics: true })
                ],
                spacing: { after: 200 }
              })
            );
          }

          if (person.notes) {
            peopleChildren.push(
              new Paragraph({
                text: "Notes:",
                bold: true,
                spacing: { before: 200, after: 100 }
              }),
              new Paragraph({
                text: person.notes,
                spacing: { after: 300 }
              })
            );
          }
        });

        peopleChildren.push(new PageBreak());
        sections.push({ children: peopleChildren });
      }

      // Connections Network
      if (reportOptions.includeConnections) {
        const connectionsData = [];
        const connectionTypes = {};
        
        data.people.forEach(person => {
          if (person.connections) {
            person.connections.forEach(conn => {
              const targetPerson = data.people.find(p => p.id === conn.person_id);
              if (targetPerson) {
                connectionsData.push({
                  source: getFullName(person),
                  target: getFullName(targetPerson),
                  type: conn.type || 'Unknown',
                  note: conn.note || ''
                });
                
                connectionTypes[conn.type || 'Unknown'] = (connectionTypes[conn.type || 'Unknown'] || 0) + 1;
              }
            });
          }
        });
        
        if (connectionsData.length > 0) {
          const connectionChildren = [
            new Paragraph({
              text: "Connections Analysis",
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 300 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Total Connections: ", bold: true }),
                new TextRun({ text: connectionsData.length.toString() })
              ],
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: "Connection Types Breakdown:",
              bold: true,
              spacing: { after: 100 }
            })
          ];

          Object.entries(connectionTypes).forEach(([type, count]) => {
            connectionChildren.push(
              new Paragraph({
                text: `• ${type}: ${count}`,
                indent: { left: 400 },
                spacing: { after: 50 }
              })
            );
          });

          connectionChildren.push(
            new Paragraph({
              text: "Connection Details",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 }
            })
          );

          // Connections table
          const connectionRows = [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: "From", bold: true })],
                  shading: { fill: "E7E7E7" }
                }),
                new TableCell({
                  children: [new Paragraph({ text: "To", bold: true })],
                  shading: { fill: "E7E7E7" }
                }),
                new TableCell({
                  children: [new Paragraph({ text: "Type", bold: true })],
                  shading: { fill: "E7E7E7" }
                }),
                new TableCell({
                  children: [new Paragraph({ text: "Notes", bold: true })],
                  shading: { fill: "E7E7E7" }
                })
              ]
            })
          ];

          connectionsData.forEach(conn => {
            connectionRows.push(
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: conn.source, size: 20 })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: conn.target, size: 20 })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: conn.type, size: 20 })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: conn.note, size: 20 })]
                  })
                ]
              })
            );
          });

          connectionChildren.push(
            new Table({
              rows: connectionRows,
              width: { size: 100, type: WidthType.PERCENTAGE }
            })
          );

          connectionChildren.push(new PageBreak());
          sections.push({ children: connectionChildren });
        }
      }

      // Locations
      if (reportOptions.includeLocations) {
        const locationsData = [];
        
        data.people.forEach(person => {
          if (person.locations && person.locations.length > 0) {
            person.locations.forEach(loc => {
              locationsData.push({
                person: getFullName(person),
                type: loc.type || 'Unknown',
                address: loc.address || 'N/A',
                city: loc.city || '',
                state: loc.state || '',
                country: loc.country || '',
                notes: loc.notes || ''
              });
            });
          }
        });
        
        if (locationsData.length > 0) {
          const locationChildren = [
            new Paragraph({
              text: "Locations",
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 300 }
            })
          ];

          // Locations table
          const locationRows = [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: "Person", bold: true })],
                  shading: { fill: "E7E7E7" }
                }),
                new TableCell({
                  children: [new Paragraph({ text: "Type", bold: true })],
                  shading: { fill: "E7E7E7" }
                }),
                new TableCell({
                  children: [new Paragraph({ text: "Address", bold: true })],
                  shading: { fill: "E7E7E7" }
                }),
                new TableCell({
                  children: [new Paragraph({ text: "Location", bold: true })],
                  shading: { fill: "E7E7E7" }
                }),
                new TableCell({
                  children: [new Paragraph({ text: "Notes", bold: true })],
                  shading: { fill: "E7E7E7" }
                })
              ]
            })
          ];

          locationsData.forEach(loc => {
            locationRows.push(
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: loc.person, size: 20 })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ 
                      text: loc.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                      size: 20 
                    })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: loc.address, size: 20 })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ 
                      text: [loc.city, loc.state, loc.country].filter(Boolean).join(', '),
                      size: 20 
                    })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: loc.notes, size: 20 })]
                  })
                ]
              })
            );
          });

          locationChildren.push(
            new Table({
              rows: locationRows,
              width: { size: 100, type: WidthType.PERCENTAGE }
            })
          );

          locationChildren.push(new PageBreak());
          sections.push({ children: locationChildren });
        }
      }

      // OSINT Data
      if (reportOptions.includeOsintData) {
        const osintData = [];
        
        data.people.forEach(person => {
          if (person.osint_data && person.osint_data.length > 0) {
            person.osint_data.forEach(osint => {
              osintData.push({
                person: getFullName(person),
                type: osint.type,
                value: osint.value,
                notes: osint.notes || ''
              });
            });
          }
        });
        
        if (osintData.length > 0) {
          const osintChildren = [
            new Paragraph({
              text: "OSINT Data",
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 300 }
            })
          ];

          // OSINT table
          const osintRows = [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: "Person", bold: true })],
                  shading: { fill: "E7E7E7" }
                }),
                new TableCell({
                  children: [new Paragraph({ text: "Type", bold: true })],
                  shading: { fill: "E7E7E7" }
                }),
                new TableCell({
                  children: [new Paragraph({ text: "Value", bold: true })],
                  shading: { fill: "E7E7E7" }
                }),
                new TableCell({
                  children: [new Paragraph({ text: "Notes", bold: true })],
                  shading: { fill: "E7E7E7" }
                })
              ]
            })
          ];

          osintData.forEach(osint => {
            osintRows.push(
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: osint.person, size: 20 })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: osint.type, size: 20 })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: osint.value, size: 20 })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: osint.notes, size: 20 })]
                  })
                ]
              })
            );
          });

          osintChildren.push(
            new Table({
              rows: osintRows,
              width: { size: 100, type: WidthType.PERCENTAGE }
            })
          );

          osintChildren.push(new PageBreak());
          sections.push({ children: osintChildren });
        }
      }

      // Tasks/Todos
      if (reportOptions.includeTodos && data.todos.length > 0) {
        const todoChildren = [
          new Paragraph({
            text: "Investigation Tasks",
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 300 }
          })
        ];

        const todosByStatus = {
          open: data.todos.filter(t => t.status === 'open'),
          in_progress: data.todos.filter(t => t.status === 'in_progress'),
          done: data.todos.filter(t => t.status === 'done')
        };
        
        todoChildren.push(
          new Paragraph({
            text: `Open: ${todosByStatus.open.length} | In Progress: ${todosByStatus.in_progress.length} | Completed: ${todosByStatus.done.length}`,
            spacing: { after: 300 }
          })
        );

        // Tasks table
        const todoRows = [
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ text: "Task", bold: true })],
                shading: { fill: "E7E7E7" }
              }),
              new TableCell({
                children: [new Paragraph({ text: "Status", bold: true })],
                shading: { fill: "E7E7E7" }
              }),
              new TableCell({
                children: [new Paragraph({ text: "Created", bold: true })],
                shading: { fill: "E7E7E7" }
              }),
              new TableCell({
                children: [new Paragraph({ text: "Updated", bold: true })],
                shading: { fill: "E7E7E7" }
              })
            ]
          })
        ];

        data.todos.forEach(todo => {
          todoRows.push(
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: todo.text, size: 20 })]
                }),
                new TableCell({
                  children: [new Paragraph({ 
                    text: todo.status.replace('_', ' ').toUpperCase(),
                    size: 20 
                  })]
                }),
                new TableCell({
                  children: [new Paragraph({ text: formatDate(todo.created_at), size: 20 })]
                }),
                new TableCell({
                  children: [new Paragraph({ text: formatDate(todo.updated_at), size: 20 })]
                })
              ]
            })
          );
        });

        todoChildren.push(
          new Table({
            rows: todoRows,
            width: { size: 100, type: WidthType.PERCENTAGE }
          })
        );

        todoChildren.push(new PageBreak());
        sections.push({ children: todoChildren });
      }

      // Statistical Analysis
      if (reportOptions.includeCharts && data.people.length > 0) {
        const statsChildren = [
          new Paragraph({
            text: "Statistical Analysis",
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 300 }
          })
        ];

        // Category distribution
        const categoryData = Object.entries(
          data.people.reduce((acc, person) => {
            const cat = person.category || 'Unknown';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          }, {})
        ).map(([name, value]) => ({ name, value }));
        
        statsChildren.push(
          new Paragraph({
            text: "Category Distribution:",
            bold: true,
            spacing: { after: 100 }
          })
        );
        
        categoryData.forEach(({ name, value }) => {
          statsChildren.push(
            new Paragraph({
              text: `• ${name}: ${value} (${Math.round(value / data.people.length * 100)}%)`,
              indent: { left: 400 },
              spacing: { after: 50 }
            })
          );
        });

        // Status distribution
        const statusData = Object.entries(
          data.people.reduce((acc, person) => {
            const status = person.status || 'Unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {})
        ).map(([name, value]) => ({ name, value }));
        
        statsChildren.push(
          new Paragraph({
            text: "Status Distribution:",
            bold: true,
            spacing: { before: 300, after: 100 }
          })
        );
        
        statusData.forEach(({ name, value }) => {
          statsChildren.push(
            new Paragraph({
              text: `• ${name}: ${value} (${Math.round(value / data.people.length * 100)}%)`,
              indent: { left: 400 },
              spacing: { after: 50 }
            })
          );
        });

        statsChildren.push(new PageBreak());
        sections.push({ children: statsChildren });
      }

      // Report Information (Final Page)
      const reportInfoChildren = [
        new Paragraph({
          text: "Report Information",
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 300 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Generated By: ", bold: true }),
            new TextRun({ text: "OSINT Investigation CRM" })
          ],
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Generation Date: ", bold: true }),
            new TextRun({ text: formatDateTime(new Date()) })
          ],
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Report Type: ", bold: true }),
            new TextRun({ text: reportOptions.reportType })
          ],
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Data Sources: ", bold: true }),
            new TextRun({ text: "Internal Database" })
          ],
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Classification: ", bold: true }),
            new TextRun({ text: "CONFIDENTIAL", color: "FF0000" })
          ],
          spacing: { after: 400 }
        }),
        new Paragraph({
          text: "Disclaimer",
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 200 }
        }),
        new Paragraph({
          text: "This report contains confidential information and is intended solely for the use of authorized personnel. " +
                "Any unauthorized disclosure, copying, or distribution is strictly prohibited.",
          italics: true,
          size: 20
        })
      ];

      sections.push({ children: reportInfoChildren });

      // Create the document
      const doc = new Document({
        sections: sections,
        styles: {
          paragraphStyles: [
            {
              id: "Title",
              name: "Title",
              basedOn: "Normal",
              next: "Normal",
              run: {
                size: 48,
                bold: true,
                color: "2B5797"
              },
              paragraph: {
                spacing: { after: 300 }
              }
            }
          ]
        }
      });

      // Generate and save the document
      const blob = await Packer.toBlob(doc);
      const filename = `investigation-report-${data.selectedCase?.case_name || 'general'}-${new Date().getTime()}.docx`;
      saveAs(blob, filename);
      
    } catch (error) {
      console.error('Error generating Word document:', error);
      alert('Failed to generate Word document');
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
                    <span className="font-medium">Document Format:</span>
                    <span className="text-sm text-gray-600">Microsoft Word (.docx)</span>
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
            onClick={generateWord}
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
                Generate Word Document
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportGenerator;