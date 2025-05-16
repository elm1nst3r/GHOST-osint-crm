// frontend/src/App.js
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import ReactFlow, {
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge as rfAddEdge, // aliased to avoid conflict
  MarkerType // For edge markers
} from 'reactflow';

const API_BASE_URL = 'http://localhost:3001/api'; // Backend API
const BACKEND_PUBLIC_URL = 'http://localhost:3001'; // For accessing static files

// --- Icon Component (Placeholder - replace with lucide-react if installed) ---
const Icon = ({ name, className = "w-5 h-5" }) => {
  const iconMap = {
    LayoutDashboard: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 14a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 14a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    Users: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 016-6h6a6 6 0 016 6v1h-3" /></svg>,
    Target: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-4a2 2 0 100-4 2 2 0 000 4z" /></svg>,
    Briefcase: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    Link: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656-5.656l-4-4a4 4 0 00-5.656 0l-1.1 1.1" /></svg>,
    Search: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    PlusCircle: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Edit2: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    Trash2: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Eye: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
    Settings: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    X: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    ListChecks: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    UploadCloud: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-4-4V7a4 4 0 014-4h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H17a4 4 0 014 4v5a4 4 0 01-4 4H7zm0 0l3 3m0 0l3-3m-3 3V6" /></svg>,
    DownloadCloud: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-4-4V7a4 4 0 014-4h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H17a4 4 0 014 4v5a4 4 0 01-4 4H7zm0 0l3 3m0 0l3-3m-3 3V6m-7 12h14" /></svg>,
    FileText: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    MapPin: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    Network: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2zM9 7h6" /></svg>,
    Image: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Type: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M12 4v16" /></svg>,
    Activity: () => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
  };
  const IconComponent = iconMap[name];
  return IconComponent ? <IconComponent /> : <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 2L2 22h20L12 2zm0 4l7 12H5l7-12z" /></svg>;
};

// --- Constants and Helpers ---
const defaultPersonCategories = ['Person of Interest', 'Possible Client', 'Client', 'Connected Person', 'Non Client', 'Asset', 'Organization', 'Event'];
const defaultPersonStatuses = ['Open', 'Being Investigated', 'Completed', 'Closed'];
const defaultCrmStatuses = ['N/A', 'Open', 'Contacted', 'Active', 'Non-Responsive', 'Closed'];
const defaultToolCategories = ['Search Engines', 'Social Media Analysis', 'Username Checkers', 'Email Verification/Lookup', 'Phone Number Lookup', 'Domain/IP Research', 'Image Analysis', 'Dark Web Search', 'Data Breach Checkers', 'Mapping/Geolocation', 'Document Analysis', 'Business/Company Research', 'Link Analysis', 'Vulnerability Scanners', 'Network Analysis', 'Other'];
const defaultToolStatuses = ['Active', 'Deprecated', 'Beta', 'Planned', 'Internal'];
const defaultOsintDataTypes = ['social_media', 'email', 'location', 'phone', 'username', 'website', 'document', 'note', 'vehicle', 'financial', 'employment', 'education', 'ip_address', 'domain_registration', 'image_attachment'];

function generateId() { return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; }
const formatDate = (dateString) => { if (!dateString) return 'N/A'; try { return new Date(dateString).toLocaleString(); } catch (e) { return 'Invalid Date'; } };
const formatInputDate = (dateString) => { if (!dateString) return ''; try { return new Date(dateString).toISOString().split('T')[0]; } catch (e) { return ''; } };
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// --- Main Application Component ---
function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isPeopleLoading, setIsPeopleLoading] = useState(false);
  const [isToolsLoading, setIsToolsLoading] = useState(false);
  const [isTodosLoading, setIsTodosLoading] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [error, setError] = useState(null);

  // Settings State
  const [appName, setAppName] = useState(() => localStorage.getItem('osintCrmAppName') || 'OSINT CRM');
  const [appLogoUrl, setAppLogoUrl] = useState(() => localStorage.getItem('osintCrmAppLogoUrl') || '');
  const [appLogoFilePreview, setAppLogoFilePreview] = useState(null);
  const [personCategories, setPersonCategories] = useState(() => JSON.parse(localStorage.getItem('osintCrmPersonCategories')) || defaultPersonCategories);
  const [personStatuses, setPersonStatuses] = useState(() => JSON.parse(localStorage.getItem('osintCrmPersonStatuses')) || defaultPersonStatuses);
  const [crmStatuses, setCrmStatuses] = useState(() => JSON.parse(localStorage.getItem('osintCrmCrmStatuses')) || defaultCrmStatuses);
  const [toolCategories, setToolCategories] = useState(() => JSON.parse(localStorage.getItem('osintCrmToolCategories')) || defaultToolCategories);
  const [toolStatuses, setToolStatuses] = useState(() => JSON.parse(localStorage.getItem('osintCrmToolStatuses')) || defaultToolStatuses);
  const [osintDataTypes, setOsintDataTypes] = useState(() => JSON.parse(localStorage.getItem('osintCrmOsintDataTypes')) || defaultOsintDataTypes);

  // Data State
  const [people, setPeople] = useState([]);
  const [tools, setTools] = useState([]);
  const [todos, setTodos] = useState([]);
  const [auditLog, setAuditLog] = useState(() => JSON.parse(localStorage.getItem('osintCrmAuditLog')) || []);

  // UI State
  const [searchTermPeople, setSearchTermPeople] = useState('');
  const [filterPersonCategory, setFilterPersonCategory] = useState('');
  const [filterPersonStatus, setFilterPersonStatus] = useState('');
  const [searchTermTools, setSearchTermTools] = useState('');
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [selectedPersonDetails, setSelectedPersonDetails] = useState(null);
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);

  // Persist settings and auditLog to localStorage
  useEffect(() => { localStorage.setItem('osintCrmAppName', appName); }, [appName]);
  useEffect(() => { localStorage.setItem('osintCrmAppLogoUrl', appLogoUrl); }, [appLogoUrl]);
  useEffect(() => { localStorage.setItem('osintCrmPersonCategories', JSON.stringify(personCategories)); }, [personCategories]);
  useEffect(() => { localStorage.setItem('osintCrmPersonStatuses', JSON.stringify(personStatuses)); }, [personStatuses]);
  useEffect(() => { localStorage.setItem('osintCrmCrmStatuses', JSON.stringify(crmStatuses)); }, [crmStatuses]);
  useEffect(() => { localStorage.setItem('osintCrmToolCategories', JSON.stringify(toolCategories)); }, [toolCategories]);
  useEffect(() => { localStorage.setItem('osintCrmToolStatuses', JSON.stringify(toolStatuses)); }, [toolStatuses]);
  useEffect(() => { localStorage.setItem('osintCrmOsintDataTypes', JSON.stringify(osintDataTypes)); }, [osintDataTypes]);
  useEffect(() => { localStorage.setItem('osintCrmAuditLog', JSON.stringify(auditLog)); }, [auditLog]);

  const addAuditLogEntry = useCallback((action, entityType, entityNameOrId, details = '') => {
    const newEntry = { id: generateId(), timestamp: new Date().toISOString(), action, entityType, entityNameOrId, details };
    setAuditLog(prevLog => [newEntry, ...prevLog].slice(0, 100));
  }, []);

  // --- Data Fetching Callbacks ---
  const fetchPeople = useCallback(async () => { /* ... (Same as before) ... */ }, []);
  const fetchTools = useCallback(async () => { /* ... (Same as before) ... */ }, []);
  const fetchTodos = useCallback(async () => { /* ... (Same as before) ... */ }, []);

  useEffect(() => {
    fetchPeople();
    fetchTools();
    fetchTodos();
  }, [fetchPeople, fetchTools, fetchTodos]);

  // --- CRUD Handlers (People, Tools, Todos - same as before) ---
  const handleOpenAddPersonModal = () => { setEditingPerson(null); setIsPersonModalOpen(true); };
  const handleOpenEditPersonModal = (person) => { setEditingPerson(person); setIsPersonModalOpen(true); };
  const handleViewPersonDetails = (person) => { setSelectedPersonDetails(person); };
  const handleSavePerson = async (personData) => { /* ... (Same as before) ... */ };
  const handleDeletePerson = async (personId) => { /* ... (Same as before) ... */ };
  const handleOpenAddToolModal = () => { setEditingTool(null); setIsToolModalOpen(true); };
  const handleOpenEditToolModal = (tool) => { setEditingTool(tool); setIsToolModalOpen(true); };
  const handleSaveTool = async (toolData) => { /* ... (Same as before) ... */ };
  const handleDeleteTool = async (toolId) => { /* ... (Same as before) ... */ };
  const handleOpenAddEditTodoModal = (todo = null) => { setEditingTodo(todo); setIsTodoModalOpen(true); };
  const handleSaveTodo = async (todoData) => { /* ... (Same as before) ... */ };
  const handleDeleteTodo = async (todoId) => { /* ... (Same as before) ... */ };
  const handleToggleTodoStatus = async (todoId) => { /* ... (Same as before) ... */ };

  // --- Logo Upload Handler ---
  const handleLogoUpload = async (file) => { /* ... (Same as before) ... */ };

  // Filtered Data
  const filteredPeople = useMemo(() => {
    if (!Array.isArray(people)) return [];
    return people.filter(person =>
      (person.name?.toLowerCase() || '').includes(searchTermPeople.toLowerCase()) &&
      (filterPersonCategory ? person.category === filterPersonCategory : true) &&
      (filterPersonStatus ? person.status === filterPersonStatus : true)
    );
  }, [people, searchTermPeople, filterPersonCategory, filterPersonStatus]);
  const filteredTools = useMemo(() => {
    if (!Array.isArray(tools)) return [];
    return tools.filter(tool =>
      (tool.name?.toLowerCase() || '').includes(searchTermTools.toLowerCase()) ||
      (tool.category?.toLowerCase() || '').includes(searchTermTools.toLowerCase()) ||
      (tool.tags && tool.tags.some(tag => tag.toLowerCase().includes(searchTermTools.toLowerCase())))
    );
  }, [tools, searchTermTools]);
  const uniqueCaseNames = useMemo(() => {
    if (!Array.isArray(people)) return [];
    const cases = new Set(people.map(p => p.case_name).filter(Boolean));
    return Array.from(cases);
  }, [people]);

  // --- React Flow Data Preparation ---
  const getGlobalRelationshipData = useCallback(() => {
    console.log("Generating global relationship data with people:", people);
    const initialNodes = [];
    const initialEdges = [];
    const osintNodeMap = new Map(); // To track shared OSINT data points

    if (!Array.isArray(people) || people.length === 0) {
      console.log("No people data for global graph.");
      return { nodes: [], edges: [] };
    }

    people.forEach((person, pIndex) => {
      const personNodeId = `person-${person.id}`;
      initialNodes.push({
        id: personNodeId,
        type: 'default', // You can create custom node types
        data: { label: `${person.name || 'Unknown Person'} (${person.category || 'N/A'})` },
        position: { x: pIndex * 280, y: 50 + (pIndex % 3) * 120 }, // Adjust layout
        style: { backgroundColor: '#c3e6cb', color: '#155724', border: '1px solid #8fd19e', width: 200, padding: 10, textAlign: 'center', borderRadius: '8px' },
      });

      // Direct connections between people
      (Array.isArray(person.connections) ? person.connections : []).forEach(conn => {
        if (conn.personId) {
          initialEdges.push({
            id: `e-${personNodeId}-conn-person-${conn.personId}`,
            source: personNodeId,
            target: `person-${conn.personId}`,
            label: conn.relationshipType || 'connected',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#0ea5e9' },
            style: { stroke: '#0ea5e9', strokeWidth: 2 },
          });
        }
      });

      // Connections to OSINT data points
      (Array.isArray(person.osint_data) ? person.osint_data : []).forEach((item, itemIndex) => {
        let itemValue = item.value || item.address || item.handle;
        if (!itemValue || typeof itemValue !== 'string') return; // Ensure itemValue is a string

        const itemKey = `${item.type}:${itemValue}`;
        let osintNodeId = osintNodeMap.get(itemKey);

        if (!osintNodeId) {
          osintNodeId = `osint-${itemKey.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50)}`; // Sanitize & shorten ID
          osintNodeMap.set(itemKey, osintNodeId);
          initialNodes.push({
            id: osintNodeId,
            type: 'default',
            data: { label: `${item.type}: ${itemValue.substring(0,25)}${itemValue.length > 25 ? '...' : ''}` },
            position: { x: pIndex * 280 + (itemIndex % 2 === 0 ? -120 : 120), y: 200 + Math.floor(pIndex / 3) * 150 + (itemIndex * 40) },
            style: { backgroundColor: '#e0f2fe', color: '#075985', border: '1px solid #7dd3fc', fontSize: '0.8em', padding: 5, width: 180, textAlign: 'center', borderRadius: '4px' },
          });
        }
        initialEdges.push({
          id: `e-${personNodeId}-osint-${osintNodeId}-${itemIndex}`,
          source: personNodeId,
          target: osintNodeId,
          label: 'has',
          style: { stroke: '#60a5fa', strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#60a5fa' },
        });
      });
    });
    console.log("Generated global nodes:", initialNodes.length, "Generated global edges:", initialEdges.length);
    return { nodes: initialNodes, edges: initialEdges };
  }, [people]);


  // --- UI Components ---
  const Sidebar = () => ( /* ... (Same as previous full version) ... */ );
  const NavItem = ({ iconName, text, viewName }) => ( /* ... (Same as previous full version) ... */ );
  const Header = ({ title }) => ( /* ... (Same as previous full version) ... */ );

  const renderContent = () => { /* ... (Same as previous full version) ... */ };

  const DashboardView = () => {
    const { nodes: initialGlobalNodes, edges: initialGlobalEdges } = getGlobalRelationshipData();
    const [globalNodes, setGlobalNodes, onGlobalNodesChange] = useNodesState(initialGlobalNodes);
    const [globalEdges, setGlobalEdges, onGlobalEdgesChange] = useEdgesState(initialGlobalEdges);

    useEffect(() => {
        const { nodes, edges } = getGlobalRelationshipData();
        setGlobalNodes(nodes);
        setGlobalEdges(edges);
    }, [people, getGlobalRelationshipData, setGlobalNodes, setGlobalEdges]);

    const onGlobalConnect = useCallback((params) => setGlobalEdges((eds) => rfAddEdge(params, eds)), [setGlobalEdges]);
    const onNodeClick = (event, node) => {
        console.log('Clicked node:', node);
        if (node.id.startsWith('person-')) {
            const personId = parseInt(node.id.split('-')[1]);
            const personToView = people.find(p => p.id === personId);
            if (personToView) {
                handleViewPersonDetails(personToView);
            }
        }
    };

    const activeInvestigations = useMemo(() => (Array.isArray(people) ? people : []).filter(p => p.status === 'Being Investigated' || p.status === 'Open').sort((a,b) => new Date(b.updated_at) - new Date(a.created_at)).slice(0,5), [people]);
    const openTodos = (Array.isArray(todos) ? todos : []).filter(t => t.status === 'open');

    return (
        <div>
            <Header title="Dashboard" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <DashboardCard iconName="Briefcase" title="OSINT Tools" value={tools.length} subtitle="Registered tools" color="green" />
                <DashboardCard iconName="Users" title="Active Investigations" value={(Array.isArray(people) ? people : []).filter(p => p.status === 'Being Investigated' || p.status === 'Open').length} subtitle="People under review" color="purple" />
                <DashboardCard iconName="ListChecks" title="Open Tasks" value={openTodos.length} subtitle="Pending to-do items" color="yellow" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                    <h3 className="text-xl font-semibold text-slate-700 mb-4">Recent Active People/Cases</h3>
                    {isPeopleLoading ? <p className="text-slate-500">Loading people...</p> : activeInvestigations.length > 0 ? (
                        <ul className="space-y-3">
                            {activeInvestigations.map(person => (
                                <li key={person.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-md hover:bg-slate-100 transition-colors">
                                    <div><p className="font-medium text-slate-800">{person.name}</p><p className="text-xs text-slate-500">Case: {person.case_name || 'N/A'} - Updated: {formatDate(person.updated_at)}</p></div>
                                    <button onClick={() => handleViewPersonDetails(person)} className="text-blue-600 hover:text-blue-800 text-sm p-1"><Icon name="Eye" /></button>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-slate-500">No active people.</p>}
                </div>
                <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-slate-700">To-Do List</h3>
                        <button onClick={() => handleOpenAddEditTodoModal()} className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md flex items-center space-x-1">
                            <Icon name="PlusCircle" className="w-4 h-4" /><span>Add Task</span>
                        </button>
                    </div>
                    {isTodosLoading ? <p className="text-slate-500">Loading to-dos...</p> : todos.length > 0 ? (
                        <ul className="space-y-2 max-h-96 overflow-y-auto">
                            {todos.map(todo => (
                                <li key={todo.id} className={`p-3 rounded-md flex items-center justify-between ${todo.status === 'done' ? 'bg-green-50 line-through text-slate-500' : 'bg-slate-50 hover:bg-slate-100'}`}>
                                    <div className="flex items-center space-x-2 flex-1">
                                        <input type="checkbox" checked={todo.status === 'done'} onChange={() => handleToggleTodoStatus(todo.id)} className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500" />
                                        <div className="flex-1">
                                            <p className={`font-medium ${todo.status === 'done' ? '' : 'text-slate-800'}`}>{todo.text}</p>
                                            {todo.last_update_comment && <p className="text-xs text-slate-400 italic">Update: {todo.last_update_comment}</p>}
                                        </div>
                                    </div>
                                    <div className="space-x-1">
                                        <button onClick={() => handleOpenAddEditTodoModal(todo)} className="text-indigo-500 hover:text-indigo-700 p-1 disabled:opacity-50" disabled={todo.status === 'done'}><Icon name="Edit2" className="w-4 h-4"/></button>
                                        <button onClick={() => handleDeleteTodo(todo.id)} className="text-red-500 hover:text-red-700 p-1"><Icon name="Trash2" className="w-4 h-4"/></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-slate-500">No tasks yet. Add some!</p>}
                </div>
            </div>
             <div className="mt-6 grid grid-cols-1 gap-6">
                <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                    <h3 className="text-xl font-semibold text-slate-700 mb-4">Global Relationship Overview</h3>
                    <div className="h-[600px] w-full bg-slate-100 rounded-md border border-slate-300">
                        { (globalNodes && globalNodes.length > 0) ? (
                            <ReactFlowProvider>
                                <ReactFlow
                                    nodes={globalNodes}
                                    edges={globalEdges}
                                    onNodesChange={onGlobalNodesChange}
                                    onEdgesChange={onGlobalEdgesChange}
                                    onConnect={onGlobalConnect}
                                    onNodeClick={onNodeClick}
                                    fitView
                                    className="bg-gradient-to-br from-slate-50 to-slate-200"
                                >
                                    <MiniMap nodeStrokeWidth={3} zoomable pannable />
                                    <Controls />
                                    <Background color="#ccc" gap={20} />
                                </ReactFlow>
                            </ReactFlowProvider>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500">
                                <Icon name="Network" className="w-16 h-16 mr-2" />
                                <p>No relationship data to display. Add people, OSINT data, and connections.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
  };
  const DashboardCard = ({iconName, title, value, subtitle, color}) => { /* ... (Same as previous full version) ... */ };
  const PeopleView = () => { /* ... (Same as previous full version) ... */ };
  const ToolsView = () => { /* ... (Same as previous full version) ... */ };
  const SettingsView = () => { /* ... (Same as previous full version) ... */ };

  const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-2xl" }) => { /* ... (Same as previous full version) ... */ };
  const AddEditPersonForm = ({ person, onSave, onCancel }) => { /* ... (Same as previous full version) ... */ };

  const PersonDetailModal = ({ person, onClose, onEdit }) => {
    if (!person) return null;
    const personLocations = useMemo(() => (Array.isArray(person.osint_data) ? person.osint_data : [])
        .filter(d => d.type === 'location' && d.coordinates && typeof d.coordinates.lat === 'number' && typeof d.coordinates.lng === 'number')
    , [person.osint_data]);

    const getPersonSpecificRelationshipData = useCallback(() => {
        console.log("Generating person-specific relationship data for:", person?.name);
        const initialNodes = [];
        const initialEdges = [];
        if (!person || !person.id) {
            console.log("No person data for specific graph.");
            return { nodes: [], edges: [] };
        }

        const personNodeId = `person-${person.id}`;
        initialNodes.push({ id: personNodeId, data: { label: person.name }, position: { x: 350, y: 25 }, type: 'input', style: { backgroundColor: '#86efac', width: 180, padding: 10, textAlign: 'center', borderRadius: '8px' } });

        let yOffsetOsint = 150;
        (Array.isArray(person.osint_data) ? person.osint_data : []).forEach((item, index) => {
            const itemValue = item.value || item.address || item.handle || `item-${index}`;
            if (typeof itemValue !== 'string') return;
            const nodeId = `osint-${person.id}-${item.type}-${itemValue.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0,50)}`;
            initialNodes.push({
                id: nodeId,
                data: { label: `${item.type}: ${itemValue.substring(0, 25)}${itemValue.length > 25 ? '...' : ''}` },
                position: { x: 100 + (index % 3) * 220, y: yOffsetOsint + Math.floor(index / 3) * 90 },
                style: { fontSize: '0.8em', padding: 5, width: 180, backgroundColor: '#e0f2fe', textAlign: 'center', borderRadius: '4px' },
            });
            initialEdges.push({ id: `e-${personNodeId}-${nodeId}`, source: personNodeId, target: nodeId, label: 'has', animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#60a5fa' }, style: {stroke: '#60a5fa'} });
        });
        
        let yOffsetConnections = yOffsetOsint + Math.ceil(((Array.isArray(person.osint_data) ? person.osint_data : []).length || 0) / 3) * 90 + 60;
        (Array.isArray(person.connections) ? person.connections : []).forEach((conn, index) => {
            const connectedP = people.find(p => p.id === conn.personId);
            if (connectedP) {
                const connectedNodeId = `person-${connectedP.id}`; // Use the same prefix for consistency
                 if (!initialNodes.find(n => n.id === connectedNodeId)) {
                    initialNodes.push({ id: connectedNodeId, data: { label: connectedP.name }, position: { x: 350, y: yOffsetConnections + index * 90 }, type: 'default', style: { backgroundColor: '#fecaca', width: 180, padding: 10, textAlign: 'center', borderRadius: '8px' } });
                 }
                initialEdges.push({ id: `e-${personNodeId}-conn-${connectedNodeId}`, source: personNodeId, target: connectedNodeId, label: conn.relationshipType || 'connected', style: { stroke: '#f87171', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f87171' } });
            }
        });
        console.log("Generated person-specific nodes:", initialNodes.length, "Generated person-specific edges:", initialEdges.length);
        return { nodes: initialNodes, edges: initialEdges };
    }, [person, people]); // Added people to dependency array

    const { nodes: initialPersonNodes, edges: initialPersonEdges } = getPersonSpecificRelationshipData();
    const [personNodes, setPersonNodes, onPersonNodesChange] = useNodesState(initialPersonNodes);
    const [personEdges, setPersonEdges, onPersonEdgesChange] = useEdgesState(initialPersonEdges);

    useEffect(() => {
        const { nodes, edges } = getPersonSpecificRelationshipData();
        setPersonNodes(nodes);
        setPersonEdges(edges);
    }, [person, getPersonSpecificRelationshipData, setPersonNodes, setPersonEdges]);


    const onPersonConnect = useCallback((params) => setPersonEdges((eds) => rfAddEdge(params, eds)), [setPersonEdges]);
    const onNodeClick = (event, node) => {
        console.log('Clicked person-specific node:', node);
        if (node.id.startsWith('person-') && node.id !== `person-${person.id}`) { // Don't re-open self
            const personId = parseInt(node.id.split('-')[1]);
            const personToView = people.find(p => p.id === personId);
            if (personToView) {
                onClose(); // Close current modal
                handleViewPersonDetails(personToView); // Open new detail modal
            }
        }
    };

    return (
      <Modal isOpen={!!person} onClose={onClose} title={`Details: ${person.name}`} maxWidth="max-w-5xl">
        <div className="space-y-6">
          {/* Person Header Info */}
          <div className="flex flex-col sm:flex-row items-start space-x-0 sm:space-x-6">
            <img src={person.profile_picture_url || `https://placehold.co/150x150/E0E0E0/333?text=${person.name?.substring(0,2) || 'P'}`} alt={person.name} className="w-32 h-32 rounded-lg object-cover border border-slate-200 shadow-md mb-4 sm:mb-0" />
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-800">{person.name}</h2>
              {person.aliases && person.aliases.length > 0 && <p className="text-sm text-slate-500">Also known as: {person.aliases.join(', ')}</p>}
              {person.date_of_birth && <p className="text-sm text-slate-600 mt-1">Born: {new Date(person.date_of_birth).toLocaleDateString()}</p>}
              <p className="text-sm text-slate-600 mt-1">Case: <span className="font-medium">{person.case_name || 'N/A'}</span></p>
              <div className="mt-3 flex flex-wrap gap-2"> <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Category: {person.category}</span> <span className={`px-3 py-1 text-xs font-semibold rounded-full ${ person.status === 'Open' ? 'bg-blue-100 text-blue-800' : person.status === 'Being Investigated' ? 'bg-yellow-100 text-yellow-800' : person.status === 'Completed' ? 'bg-green-100 text-green-800' : person.status === 'Closed' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800' }`}>Status: {person.status}</span> {person.crm_status && person.crm_status !== 'N/A' && <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">CRM: {person.crm_status}</span>} </div>
              <div className="mt-3 text-xs text-slate-400"> <p>Created: {formatDate(person.created_at)}</p> <p>Last Updated: {formatDate(person.updated_at)}</p> </div>
            </div>
          </div>
          {/* Notes and OSINT Data */}
          {person.notes && ( <DetailSection title="Notes"> <p className="text-sm text-slate-700 whitespace-pre-wrap">{person.notes}</p> </DetailSection> )}
          {person.osint_data && person.osint_data.length > 0 && ( <DetailSection title="OSINT Data Points"> <ul className="space-y-3"> {person.osint_data.map((data, index) => ( <li key={data.id || index} className="p-3 bg-slate-50 rounded-md border border-slate-200"> <strong className="capitalize text-sm text-slate-700">{data.type?.replace('_', ' ') || 'Data'}:</strong> {data.platform && <span className="text-sm text-slate-600"> ({data.platform})</span>} <p className="text-sm text-slate-800">{data.url ? <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{data.handle || data.value || data.url}</a> : (data.address || data.value || data.handle)}</p> {data.notes && <p className="text-xs text-slate-500 italic mt-1">{data.notes}</p>} </li> ))} </ul> </DetailSection> )}
          
          {/* Location Map */}
          <DetailSection title="Location Map">
            <div className="h-96 w-full rounded-md overflow-hidden border border-slate-300">
              {personLocations.length > 0 ? (
                <PersonLocationMap locations={personLocations} />
              ) : (
                <div className="h-full bg-slate-100 flex items-center justify-center text-slate-500"><Icon name="MapPin" className="w-8 h-8 mr-2"/>No location data with coordinates available.</div>
              )}
            </div>
          </DetailSection>

          {/* Relationship Chart */}
          <DetailSection title="Relationship Chart (Person Specific)">
            <div className="h-[500px] w-full bg-slate-100 rounded-md border border-slate-300">
                { (personNodes && personNodes.length > 1) ? (
                    <ReactFlowProvider>
                        <ReactFlow
                            nodes={personNodes}
                            edges={personEdges}
                            onNodesChange={onPersonNodesChange}
                            onEdgesChange={onPersonEdgesChange}
                            onConnect={onPersonConnect}
                            onNodeClick={onNodeClick}
                            fitView
                            className="bg-slate-50"
                        >
                            <MiniMap nodeColor={n => {
                                if (n.type === 'input') return '#86efac'; // Person node
                                if (n.id.startsWith('osint-')) return '#e0f2fe'; // OSINT data
                                return '#fecaca'; // Other connected people
                            }}/>
                            <Controls />
                            <Background variant="dots" gap={12} size={1} />
                        </ReactFlow>
                    </ReactFlowProvider>
                ) : (
                     <div className="flex items-center justify-center h-full text-slate-500">
                        <Icon name="Network" className="w-10 h-10 mr-2" />
                        <p>Not enough data for a specific relationship chart (needs OSINT data or connections).</p>
                    </div>
                )}
            </div>
          </DetailSection>
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200"> <button onClick={() => { onClose(); onEdit(person); }} className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-md shadow-sm hover:from-indigo-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all transform hover:scale-105"> <Icon name="Edit2" className="w-4 h-4 inline-block mr-1" /> Edit Person </button> <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors">Close</button> </div>
        </div>
      </Modal>
    );
  };

  // --- Leaflet Map Component ---
  const PersonLocationMap = ({ locations }) => {
    const mapRef = useRef(null);
    const validLocations = useMemo(() =>
        (Array.isArray(locations) ? locations : [])
        .filter(loc => loc.coordinates && typeof loc.coordinates.lat === 'number' && typeof loc.coordinates.lng === 'number')
    , [locations]);

    const mapCenter = useMemo(() =>
        validLocations.length > 0 ? [validLocations[0].coordinates.lat, validLocations[0].coordinates.lng] : [20, 0] // Default center if no locations, more global
    , [validLocations]);
    
    const defaultZoom = validLocations.length > 0 ? 6 : 2; // Zoom out more if no specific locations

    // Component to auto-fit bounds or set view
    const FitBounds = ({ locs }) => {
        const map = useMap();
        useEffect(() => {
            if (locs && locs.length > 0) {
                const bounds = locs.map(l => [l.coordinates.lat, l.coordinates.lng]);
                if (bounds.length > 1) {
                    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
                } else if (bounds.length === 1) { // Single location
                    map.setView(bounds[0], 13);
                }
            } else { // No valid locations, set a default global view
                 map.setView(mapCenter, defaultZoom);
            }
        }, [locs, map]); // mapCenter and defaultZoom are stable from outer scope
        return null;
    };
    
    console.log("Map rendering with locations:", validLocations);

    if (!Array.isArray(locations)) {
        return <div className="h-full bg-slate-100 flex items-center justify-center text-slate-500"><Icon name="MapPin" className="w-8 h-8 mr-2"/>Location data is unavailable.</div>;
    }

    return (
        <MapContainer center={mapCenter} zoom={defaultZoom} scrollWheelZoom={true} style={{ height: '100%', minHeight: '300px', width: '100%' }} ref={mapRef} >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {validLocations.map(loc => (
                <Marker key={loc.id || generateId()} position={[loc.coordinates.lat, loc.coordinates.lng]}>
                    <Popup>
                        <strong>{loc.address || loc.value || 'Location'}</strong><br/>
                        {loc.notes && <p>{loc.notes}</p>}
                        Lat: {loc.coordinates.lat.toFixed(4)}, Lng: {loc.coordinates.lng.toFixed(4)}
                    </Popup>
                </Marker>
            ))}
            <FitBounds locs={validLocations} />
        </MapContainer>
    );
  };


  const AddEditToolForm = ({ tool, onSave, onCancel }) => { /* ... (Same as previous full version) ... */ };
  const AddEditTodoForm = ({ todo, onSave, onCancel }) => { /* ... (Same as previous full version) ... */ };
  const DetailSection = ({ title, children }) => ( /* ... (Same as previous full version) ... */ );
  const InputField = ({ label, name, type = "text", value, onChange, required, placeholder, small, list, ...props }) => ( /* ... (Same as previous full version) ... */ );
  const SelectField = ({ label, name, value, onChange, options, required, small, className, noLabel, ...props }) => ( /* ... (Same as previous full version) ... */ );

  // --- Main Render ---
  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      <style jsx global>{`
        body { margin: 0; font-family: 'Inter', sans-serif; background-color: #f1f5f9; color: #1e293b; }
        /* Leaflet CSS */
        @import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
        /* ReactFlow CSS */
        @import url("https://unpkg.com/reactflow@latest/dist/style.css");

        .leaflet-container { height: 100%; width: 100%; border-radius: 0.375rem; }
        .react-flow__node { font-size: 10px; background: #fff; border: 1px solid #ddd; padding: 5px; border-radius: 3px;}
        .react-flow__edge-text { font-size: 8px; }
        .react-flow__attribution { display: none; }

        .animate-modalShow { animation: modalShow 0.3s ease-out forwards; }
        @keyframes modalShow { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
      <Sidebar />
      <main className="flex-1 p-8 ml-64 overflow-y-auto">
        {renderContent()}
      </main>

      <Modal isOpen={isPersonModalOpen} onClose={() => setIsPersonModalOpen(false)} title={editingPerson ? 'Edit Person' : 'Add Person'} maxWidth="max-w-3xl">
        <AddEditPersonForm person={editingPerson} onSave={handleSavePerson} onCancel={() => setIsPersonModalOpen(false)} />
      </Modal>
      <Modal isOpen={isToolModalOpen} onClose={() => setIsToolModalOpen(false)} title={editingTool ? 'Edit OSINT Tool' : 'Add New OSINT Tool'}>
        <AddEditToolForm tool={editingTool} onSave={handleSaveTool} onCancel={() => setIsToolModalOpen(false)} />
      </Modal>
      {selectedPersonDetails && (
        <PersonDetailModal
            person={selectedPersonDetails}
            onClose={() => setSelectedPersonDetails(null)}
            onEdit={(personToEdit) => {
                setSelectedPersonDetails(null);
                handleOpenEditPersonModal(personToEdit);
            }}
        />
      )}
      <Modal isOpen={isTodoModalOpen} onClose={() => setIsTodoModalOpen(false)} title={editingTodo ? 'Edit Task' : 'Add New Task'} maxWidth="max-w-lg">
        <AddEditTodoForm todo={editingTodo} onSave={handleSaveTodo} onCancel={() => setIsTodoModalOpen(false)} />
      </Modal>
    </div>
  );
}

export default App;
