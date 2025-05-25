// File: frontend/src/components/ReportGenerator.js
import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { 
  FileText, Download, Settings, Check, Calendar, 
  User, Users, MapPin, Network, Clock, Shield, AlertCircle,
  ChevronRight, Loader2, X
} from 'lucide-react';
import { peopleAPI, casesAPI, auditAPI, todosAPI } from '../utils/api';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ReportGenerator = ({ caseId = null, personId = null, onClose }) => {
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

      // Filter data based on case or person
      let filteredPeople = peopleData;
      let selectedCase = null;
      let selectedPerson = null;

      if (caseId) {
        selectedCase = casesData.find(c => c.id === caseId);
        filteredPeople = peopleData.filter(p => p.case_name === selectedCase?.case_name);
      }

      if (personId) {
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

  const generatePDF = async () => {
    setGenerating(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Helper function to check if we need a new page
      const checkNewPage = (neededSpace = 20) => {
        if (yPosition + neededSpace > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Helper function to add a section header
      const addSectionHeader = (title) => {
        checkNewPage(20);
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(31, 41, 55); // gray-800
        pdf.text(title, margin, yPosition);
        yPosition += 10;
        
        // Add underline
        pdf.setDrawColor(219, 234, 254); // blue-100
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);
      };

      // 1. Cover Page
      pdf.setFillColor(59, 130, 246); // blue-600
      pdf.rect(0, 0, pageWidth, 60, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont(undefined, 'bold');
      pdf.text('INVESTIGATION REPORT', pageWidth / 2, 25, { align: 'center' });
      
      pdf.setFontSize(16);
      pdf.setFont(undefined, 'normal');
      if (data.selectedCase) {
        pdf.text(data.selectedCase.case_name, pageWidth / 2, 40, { align: 'center' });
      } else if (data.selectedPerson) {
        pdf.text(getFullName(data.selectedPerson), pageWidth / 2, 40, { align: 'center' });
      }
      
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(12);
      pdf.text(`Generated: ${formatDateTime(new Date())}`, pageWidth / 2, 80, { align: 'center' });
      
      // Report metadata
      yPosition = 100;
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      
      const metadata = [
        ['Report Type:', reportOptions.reportType.charAt(0).toUpperCase() + reportOptions.reportType.slice(1)],
        ['Total People:', data.people.length.toString()],
        ['Total Connections:', data.people.reduce((sum, p) => sum + (p.connections?.length || 0), 0).toString()],
        ['Date Range:', reportOptions.dateRange === 'all' ? 'All Time' : reportOptions.dateRange.replace('-', ' ')]
      ];

      metadata.forEach(([label, value]) => {
        pdf.setFont(undefined, 'bold');
        pdf.text(label, margin, yPosition);
        pdf.setFont(undefined, 'normal');
        pdf.text(value, margin + 35, yPosition);
        yPosition += 7;
      });

      // 2. Executive Summary
      if (reportOptions.includeSummary) {
        pdf.addPage();
        yPosition = margin;
        
        addSectionHeader('Executive Summary');
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');
        
        const summaryText = [];
        
        if (data.selectedCase) {
          summaryText.push(
            `This report covers the investigation case "${data.selectedCase.case_name}".`,
            `Status: ${data.selectedCase.status || 'Active'}`,
            `Created: ${formatDate(data.selectedCase.created_at)}`,
            ``,
            `The case involves ${data.people.length} individuals with ${data.people.reduce((sum, p) => sum + (p.connections?.length || 0), 0)} documented connections.`
          );
          
          if (data.selectedCase.description) {
            summaryText.push('', 'Case Description:', data.selectedCase.description);
          }
        } else if (data.selectedPerson) {
          summaryText.push(
            `This report focuses on ${getFullName(data.selectedPerson)}.`,
            `Category: ${data.selectedPerson.category || 'N/A'}`,
            `Status: ${data.selectedPerson.status || 'N/A'}`,
            `Connections: ${data.selectedPerson.connections?.length || 0}`
          );
        }
        
        summaryText.forEach(line => {
          if (line === '') {
            yPosition += 5;
          } else {
            const lines = pdf.splitTextToSize(line, pageWidth - 2 * margin);
            pdf.text(lines, margin, yPosition);
            yPosition += lines.length * 5;
          }
        });
      }

      // 3. People Profiles
      if (reportOptions.includePeople && data.people.length > 0) {
        pdf.addPage();
        yPosition = margin;
        
        addSectionHeader('People Profiles');
        
        data.people.forEach((person, index) => {
          checkNewPage(60);
          
          // Person header
          pdf.setFillColor(248, 250, 252); // gray-50
          pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
          
          pdf.setFontSize(11);
          pdf.setFont(undefined, 'bold');
          pdf.text(`${index + 1}. ${getFullName(person)}`, margin + 2, yPosition + 5);
          yPosition += 12;
          
          pdf.setFontSize(9);
          pdf.setFont(undefined, 'normal');
          
          // Person details in two columns
          const leftCol = margin + 2;
          const rightCol = pageWidth / 2 + 5;
          let rowY = yPosition;
          
          // Left column
          pdf.text(`Category: ${person.category || 'N/A'}`, leftCol, rowY);
          rowY += 5;
          pdf.text(`Status: ${person.status || 'N/A'}`, leftCol, rowY);
          rowY += 5;
          if (person.date_of_birth) {
            pdf.text(`DOB: ${formatDate(person.date_of_birth)}`, leftCol, rowY);
            rowY += 5;
          }
          
          // Right column
          rowY = yPosition;
          pdf.text(`Case: ${person.case_name || 'N/A'}`, rightCol, rowY);
          rowY += 5;
          pdf.text(`CRM Status: ${person.crm_status || 'N/A'}`, rightCol, rowY);
          rowY += 5;
          pdf.text(`Connections: ${person.connections?.length || 0}`, rightCol, rowY);
          
          yPosition = Math.max(rowY, yPosition + 20);
          
          // Aliases
          if (person.aliases && person.aliases.length > 0) {
            pdf.setFont(undefined, 'italic');
            pdf.text(`Aliases: ${person.aliases.join(', ')}`, leftCol, yPosition);
            yPosition += 5;
          }
          
          // Notes
          if (person.notes) {
            pdf.setFont(undefined, 'normal');
            const noteLines = pdf.splitTextToSize(`Notes: ${person.notes}`, pageWidth - 2 * margin - 4);
            pdf.text(noteLines, leftCol, yPosition);
            yPosition += noteLines.length * 4 + 5;
          }
          
          yPosition += 5; // Space between people
        });
      }

      // 4. Connections Network
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
          pdf.addPage();
          yPosition = margin;
          
          addSectionHeader('Connections Analysis');
          
          // Connection statistics
          pdf.setFontSize(10);
          pdf.setFont(undefined, 'normal');
          pdf.text(`Total Connections: ${connectionsData.length}`, margin, yPosition);
          yPosition += 7;
          
          // Connection types breakdown
          pdf.text('Connection Types:', margin, yPosition);
          yPosition += 5;
          
          Object.entries(connectionTypes).forEach(([type, count]) => {
            pdf.text(`  • ${type}: ${count}`, margin + 5, yPosition);
            yPosition += 5;
          });
          
          yPosition += 5;
          
          // Connections table
          checkNewPage(30);
          pdf.autoTable({
            startY: yPosition,
            head: [['From', 'To', 'Type', 'Notes']],
            body: connectionsData.map(conn => [
              conn.source,
              conn.target,
              conn.type,
              conn.note
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [59, 130, 246] },
            margin: { left: margin, right: margin }
          });
          
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      // 5. Locations
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
          checkNewPage(30);
          addSectionHeader('Locations');
          
          pdf.autoTable({
            startY: yPosition,
            head: [['Person', 'Type', 'Address', 'City/State/Country', 'Notes']],
            body: locationsData.map(loc => [
              loc.person,
              loc.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              loc.address,
              [loc.city, loc.state, loc.country].filter(Boolean).join(', '),
              loc.notes
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [59, 130, 246] },
            margin: { left: margin, right: margin },
            columnStyles: {
              0: { cellWidth: 35 },
              1: { cellWidth: 25 },
              2: { cellWidth: 45 },
              3: { cellWidth: 45 },
              4: { cellWidth: 30 }
            }
          });
          
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      // 6. OSINT Data
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
          checkNewPage(30);
          addSectionHeader('OSINT Data');
          
          pdf.autoTable({
            startY: yPosition,
            head: [['Person', 'Type', 'Value', 'Notes']],
            body: osintData.map(osint => [
              osint.person,
              osint.type,
              osint.value,
              osint.notes
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [59, 130, 246] },
            margin: { left: margin, right: margin }
          });
          
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      // 7. Tasks/Todos
      if (reportOptions.includeTodos && data.todos.length > 0) {
        checkNewPage(30);
        addSectionHeader('Investigation Tasks');
        
        const todosByStatus = {
          open: data.todos.filter(t => t.status === 'open'),
          in_progress: data.todos.filter(t => t.status === 'in_progress'),
          done: data.todos.filter(t => t.status === 'done')
        };
        
        pdf.setFontSize(10);
        pdf.text(`Open: ${todosByStatus.open.length} | In Progress: ${todosByStatus.in_progress.length} | Completed: ${todosByStatus.done.length}`, margin, yPosition);
        yPosition += 10;
        
        pdf.autoTable({
          startY: yPosition,
          head: [['Task', 'Status', 'Created', 'Updated']],
          body: data.todos.map(todo => [
            todo.text,
            todo.status.replace('_', ' ').toUpperCase(),
            formatDate(todo.created_at),
            formatDate(todo.updated_at)
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: margin, right: margin }
        });
        
        yPosition = pdf.lastAutoTable.finalY + 10;
      }

      // 8. Timeline (Audit Log)
      if (reportOptions.includeAuditLog && data.auditLogs.length > 0) {
        checkNewPage(30);
        addSectionHeader('Activity Timeline');
        
        const relevantLogs = data.auditLogs
          .filter(log => {
            if (personId) return log.entity_type === 'person' && log.entity_id === personId;
            return true;
          })
          .slice(0, 50); // Limit to recent 50 entries
        
        pdf.autoTable({
          startY: yPosition,
          head: [['Date/Time', 'Entity', 'Action', 'Field', 'Changes']],
          body: relevantLogs.map(log => [
            formatDateTime(log.created_at),
            `${log.entity_type} #${log.entity_id}`,
            log.action,
            log.field_name || 'N/A',
            log.new_value ? 'Updated' : 'N/A'
          ]),
          styles: { fontSize: 7 },
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: margin, right: margin }
        });
      }

      // 9. Charts Page
      if (reportOptions.includeCharts && data.people.length > 0) {
        pdf.addPage();
        yPosition = margin;
        
        addSectionHeader('Statistical Analysis');
        
        // Create a temporary div to render charts
        const chartContainer = document.createElement('div');
        chartContainer.style.position = 'absolute';
        chartContainer.style.left = '-9999px';
        chartContainer.style.width = '800px';
        chartContainer.style.height = '400px';
        chartContainer.style.backgroundColor = 'white';
        document.body.appendChild(chartContainer);
        
        try {
          // Render charts using the existing chart components
          const categoryData = Object.entries(
            data.people.reduce((acc, person) => {
              const cat = person.category || 'Unknown';
              acc[cat] = (acc[cat] || 0) + 1;
              return acc;
            }, {})
          ).map(([name, value]) => ({ name, value }));
          
          const statusData = Object.entries(
            data.people.reduce((acc, person) => {
              const status = person.status || 'Unknown';
              acc[status] = (acc[status] || 0) + 1;
              return acc;
            }, {})
          ).map(([name, value]) => ({ name, value }));
          
          // You would render actual React components here and capture them
          // For now, we'll add text placeholders
          pdf.setFontSize(10);
          pdf.text('Category Distribution:', margin, yPosition);
          yPosition += 7;
          
          categoryData.forEach(({ name, value }) => {
            pdf.text(`  • ${name}: ${value} (${Math.round(value / data.people.length * 100)}%)`, margin + 5, yPosition);
            yPosition += 5;
          });
          
          yPosition += 10;
          pdf.text('Status Distribution:', margin, yPosition);
          yPosition += 7;
          
          statusData.forEach(({ name, value }) => {
            pdf.text(`  • ${name}: ${value} (${Math.round(value / data.people.length * 100)}%)`, margin + 5, yPosition);
            yPosition += 5;
          });
          
        } finally {
          document.body.removeChild(chartContainer);
        }
      }

      // Final page - Report metadata
      pdf.addPage();
      yPosition = margin;
      
      addSectionHeader('Report Information');
      pdf.setFontSize(9);
      pdf.setFont(undefined, 'normal');
      
      const reportInfo = [
        ['Generated By:', 'OSINT Investigation CRM'],
        ['Generation Date:', formatDateTime(new Date())],
        ['Report Type:', reportOptions.reportType],
        ['Total Pages:', pdf.internal.getNumberOfPages().toString()],
        ['Data Sources:', 'Internal Database'],
        ['Classification:', 'CONFIDENTIAL']
      ];
      
      reportInfo.forEach(([label, value]) => {
        pdf.setFont(undefined, 'bold');
        pdf.text(label, margin, yPosition);
        pdf.setFont(undefined, 'normal');
        pdf.text(value, margin + 40, yPosition);
        yPosition += 6;
      });
      
      // Disclaimer
      yPosition += 10;
      pdf.setFontSize(8);
      pdf.setFont(undefined, 'italic');
      const disclaimer = 'This report contains confidential information and is intended solely for the use of authorized personnel. ' +
                        'Any unauthorized disclosure, copying, or distribution is strictly prohibited.';
      const disclaimerLines = pdf.splitTextToSize(disclaimer, pageWidth - 2 * margin);
      pdf.text(disclaimerLines, margin, yPosition);

      // Save the PDF
      const filename = `investigation-report-${data.selectedCase?.case_name || 'general'}-${new Date().getTime()}.pdf`;
      pdf.save(filename);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF report');
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
                    <span className="font-medium">Estimated Pages:</span>
                    <span className="text-sm text-gray-600">
                      {Math.ceil(
                        (reportOptions.includeSummary ? 1 : 0) +
                        (reportOptions.includePeople ? Math.ceil(data.people.length / 3) : 0) +
                        (reportOptions.includeConnections ? 2 : 0) +
                        (reportOptions.includeLocations ? 1 : 0) +
                        (reportOptions.includeOsintData ? 1 : 0) +
                        (reportOptions.includeTodos ? 1 : 0) +
                        (reportOptions.includeAuditLog ? 2 : 0) +
                        (reportOptions.includeCharts ? 1 : 0) +
                        1 // Report info page
                      )} pages
                    </span>
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
            onClick={generatePDF}
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
                Generate PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportGenerator;