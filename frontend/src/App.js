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
  addEdge as rfAddEdge, // aliased to avoid conflict with our addEdge
  Handle,
  Position
} from 'reactflow';

const API_BASE_URL = 'http://localhost:3001/api'; // Backend API
const BACKEND_PUBLIC_URL = 'http://localhost:3001'; // For accessing static files

// --- Icon Component (Placeholder) ---
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

// --- Constants and Helpers (same as before) ---
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
  const fetchPeople = useCallback(async () => {
    setIsPeopleLoading(true); setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/people`);
      if (!response.ok) { const errorText = await response.text(); throw new Error(`HTTP error! status: ${response.status} - ${errorText}`); }
      const data = await response.json(); setPeople(data);
    } catch (e) { console.error("Failed to fetch people:", e); setError(`People: ${e.message}`); setPeople([]); }
    finally { setIsPeopleLoading(false); }
  }, []);

  const fetchTools = useCallback(async () => {
    setIsToolsLoading(true); setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/tools`);
      if (!response.ok) { const errorText = await response.text(); throw new Error(`HTTP error! status: ${response.status} - ${errorText}`); }
      const data = await response.json(); setTools(data);
    } catch (e) { console.error("Failed to fetch tools:", e); setError(`Tools: ${e.message}`); setTools([]); }
    finally { setIsToolsLoading(false); }
  }, []);

  const fetchTodos = useCallback(async () => {
    setIsTodosLoading(true); setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/todos`);
      if (!response.ok) { const errorText = await response.text(); throw new Error(`HTTP error! status: ${response.status} - ${errorText}`); }
      const data = await response.json(); setTodos(data);
    } catch (e) { console.error("Failed to fetch todos:", e); setError(`To-Dos: ${e.message}`); setTodos([]); }
    finally { setIsTodosLoading(false); }
  }, []);


  useEffect(() => {
    fetchPeople();
    fetchTools();
    fetchTodos();
  }, [fetchPeople, fetchTools, fetchTodos]);

  // --- CRUD Handlers ---
  const handleOpenAddPersonModal = () => { setEditingPerson(null); setIsPersonModalOpen(true); };
  const handleOpenEditPersonModal = (person) => { setEditingPerson(person); setIsPersonModalOpen(true); };
  const handleViewPersonDetails = (person) => { setSelectedPersonDetails(person); };
  const handleSavePerson = async (personData) => {
    setIsPeopleLoading(true); setError(null);
    const method = editingPerson ? 'PUT' : 'POST';
    const url = editingPerson ? `${API_BASE_URL}/people/${editingPerson.id}` : `${API_BASE_URL}/people`;
    const processedPersonData = { ...personData, attachments: personData.attachments?.map(({ fileObject, ...rest }) => rest) || [] };
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(processedPersonData) });
      if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || `HTTP error! status: ${response.status}`); }
      addAuditLogEntry(editingPerson ? 'UPDATE' : 'CREATE', 'Person', personData.name);
      await fetchPeople();
      setIsPersonModalOpen(false); setEditingPerson(null);
    } catch (e) { console.error("Failed to save person:", e); setError(`Save Person: ${e.message}`); }
    finally { setIsPeopleLoading(false); }
  };
  const handleDeletePerson = async (personId) => {
    const personToDelete = people.find(p => p.id === personId);
    if (window.confirm(`Are you sure you want to delete ${personToDelete?.name || 'this person'}?`)) {
      setIsPeopleLoading(true); setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/people/${personId}`, { method: 'DELETE' });
        if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || `HTTP error! status: ${response.status}`);}
        const deletedData = await response.json();
        addAuditLogEntry('DELETE', 'Person', deletedData.deletedPerson?.name || personId);
        await fetchPeople();
      } catch (e) { console.error("Failed to delete person:", e); setError(`Delete Person: ${e.message}`); }
      finally { setIsPeopleLoading(false); }
    }
  };

  const handleOpenAddToolModal = () => { setEditingTool(null); setIsToolModalOpen(true); };
  const handleOpenEditToolModal = (tool) => { setEditingTool(tool); setIsToolModalOpen(true); };
  const handleSaveTool = async (toolData) => {
    setIsToolsLoading(true); setError(null);
    const method = editingTool ? 'PUT' : 'POST';
    const url = editingTool ? `${API_BASE_URL}/tools/${editingTool.id}` : `${API_BASE_URL}/tools`;
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toolData) });
      if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || `HTTP error! status: ${response.status}`); }
      addAuditLogEntry(editingTool ? 'UPDATE' : 'CREATE', 'Tool', toolData.name);
      await fetchTools();
      setIsToolModalOpen(false); setEditingTool(null);
    } catch (e) { console.error("Failed to save tool:", e); setError(`Save Tool: ${e.message}`); }
    finally { setIsToolsLoading(false); }
  };
  const handleDeleteTool = async (toolId) => {
    const toolToDelete = tools.find(t => t.id === toolId);
    if (window.confirm(`Are you sure you want to delete ${toolToDelete?.name || 'this tool'}?`)) {
      setIsToolsLoading(true); setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/tools/${toolId}`, { method: 'DELETE' });
        if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || `HTTP error! status: ${response.status}`); }
        const deletedData = await response.json();
        addAuditLogEntry('DELETE', 'Tool', deletedData.deletedTool?.name || toolId);
        await fetchTools();
      } catch (e) { console.error("Failed to delete tool:", e); setError(`Delete Tool: ${e.message}`); }
      finally { setIsToolsLoading(false); }
    }
  };

  const handleOpenAddEditTodoModal = (todo = null) => { setEditingTodo(todo); setIsTodoModalOpen(true); };
  const handleSaveTodo = async (todoData) => {
    setIsTodosLoading(true); setError(null);
    const method = editingTodo ? 'PUT' : 'POST';
    const url = editingTodo ? `${API_BASE_URL}/todos/${editingTodo.id}` : `${API_BASE_URL}/todos`;
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(todoData) });
      if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || `HTTP error! status: ${response.status}`); }
      addAuditLogEntry(editingTodo ? 'UPDATE' : 'CREATE', 'Todo', todoData.text.substring(0,20));
      await fetchTodos();
      setIsTodoModalOpen(false); setEditingTodo(null);
    } catch (e) { console.error("Failed to save todo:", e); setError(`Save To-Do: ${e.message}`); }
    finally { setIsTodosLoading(false); }
  };
  const handleDeleteTodo = async (todoId) => {
    const todoToDelete = todos.find(t => t.id === todoId);
    if (window.confirm(`Are you sure you want to delete task: "${todoToDelete?.text || 'this task'}"?`)) {
      setIsTodosLoading(true); setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/todos/${todoId}`, { method: 'DELETE' });
        if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || `HTTP error! status: ${response.status}`); }
        const deletedData = await response.json();
        addAuditLogEntry('DELETE', 'Todo', deletedData.deletedTodo?.text.substring(0,20) || todoId);
        await fetchTodos();
      } catch (e) { console.error("Failed to delete todo:", e); setError(`Delete To-Do: ${e.message}`); }
      finally { setIsTodosLoading(false); }
    }
  };
  const handleToggleTodoStatus = async (todoId) => {
    const todoToToggle = todos.find(t => t.id === todoId);
    if (!todoToToggle) return;
    const updatedStatus = todoToToggle.status === 'open' ? 'done' : 'open';
    const updatedTodoPayload = { ...todoToToggle, text: todoToToggle.text, status: updatedStatus, last_update_comment: `Status changed to ${updatedStatus}` };
    setIsTodosLoading(true); setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/todos/${todoId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedTodoPayload) });
      if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || `HTTP error! status: ${response.status}`); }
      addAuditLogEntry('UPDATE', 'Todo', todoToToggle.text.substring(0,20), `Toggled status to ${updatedStatus}`);
      await fetchTodos();
    } catch (e) { console.error("Failed to toggle todo status:", e); setError(`Toggle To-Do: ${e.message}`); }
    finally { setIsTodosLoading(false); }
  };

  // --- Logo Upload Handler ---
  const handleLogoUpload = async (file) => {
    if (!file) return;
    setIsUploadingLogo(true); setError(null);
    const formData = new FormData();
    formData.append('appLogo', file);
    try {
      const response = await fetch(`${API_BASE_URL}/upload/logo`, { method: 'POST', body: formData });
      if (!response.ok) { const errData = await response.json().catch(() => ({ error: 'Failed to upload logo.' })); throw new Error(errData.error || `HTTP error! status: ${response.status}`); }
      const result = await response.json();
      setAppLogoUrl(BACKEND_PUBLIC_URL + result.logoUrl);
      setAppLogoFilePreview(null);
      addAuditLogEntry('UPDATE_SETTING', 'Setting', 'Application Logo', `Uploaded new logo: ${result.logoUrl}`);
      alert('Logo uploaded successfully!');
    } catch (e) { console.error("Failed to upload logo:", e); setError(`Logo Upload: ${e.message}`); alert(`Logo upload failed: ${e.message}`); }
    finally { setIsUploadingLogo(false); }
  };

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

  // --- UI Components ---
  const Sidebar = () => (
    <div className="w-64 bg-slate-800 text-slate-100 p-5 space-y-4 fixed top-0 left-0 h-full shadow-lg z-30">
      <div className="text-center mb-8">
        {appLogoUrl ? (
          <img src={appLogoUrl} alt={`${appName} Logo`} className="h-16 w-auto max-w-full mx-auto mb-2 object-contain" onError={(e) => { e.target.src = 'https://placehold.co/64x64/3B82F6/FFFFFF?text=Logo'; }} />
        ) : appLogoFilePreview ? (
          <img src={appLogoFilePreview} alt={`${appName} Logo Preview`} className="h-16 w-auto max-w-full mx-auto mb-2 object-contain" />
        ) : (
          <div className="h-16 w-16 mx-auto mb-2 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
            {appName.substring(0,1) || 'C'}
          </div>
        )}
        <div className={`text-2xl font-bold bg-gradient-to-r from-blue-500 to-teal-400 text-white py-3 rounded-lg shadow-md mt-2`}>
          {appName}
        </div>
      </div>
      <nav>
        <ul>
          <NavItem iconName="LayoutDashboard" text="Dashboard" viewName="dashboard" />
          <NavItem iconName="Target" text="People" viewName="people" />
          <NavItem iconName="Briefcase" text="OSINT Tools" viewName="tools" />
          <NavItem iconName="Settings" text="Settings" viewName="settings" />
        </ul>
      </nav>
      <div className="absolute bottom-5 left-5 text-xs text-slate-400">Version 0.9.0</div> {/* Updated Version */}
    </div>
  );
  const NavItem = ({ iconName, text, viewName }) => (
     <li
      className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors ${currentView === viewName ? 'bg-slate-700 border-l-4 border-blue-500' : ''}`}
      onClick={() => setCurrentView(viewName)}
    >
      <Icon name={iconName} className="w-6 h-6 text-blue-400" />
      <span>{text}</span>
    </li>
  );
  const Header = ({ title }) => (
    <header className="bg-white shadow-sm p-6 mb-6 rounded-lg">
      <h1 className="text-3xl font-semibold text-slate-800">{title}</h1>
    </header>
  );

  const renderContent = () => {
    if (error) { return <div className="p-6 text-center text-red-600 bg-red-100 rounded-md shadow-md">{error}</div>; }
    switch (currentView) {
      case 'dashboard': return <DashboardView />;
      case 'people': return <PeopleView />;
      case 'tools': return <ToolsView />;
      case 'settings': return <SettingsView />;
      default: return <DashboardView />;
    }
  };

  const DashboardView = () => {
    const activeInvestigations = useMemo(() =>
        (Array.isArray(people) ? people : []).filter(p => p.status === 'Being Investigated' || p.status === 'Open')
              .sort((a,b) => new Date(b.updated_at) - new Date(a.created_at))
              .slice(0,5),
    [people]);
    const openTodos = (Array.isArray(todos) ? todos : []).filter(t => t.status === 'open');

    return (
        <div>
            <Header title="Dashboard" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <DashboardCard iconName="Briefcase" title="OSINT Tools" value={tools.length} subtitle="Registered tools" color="green" />
                <DashboardCard iconName="Users" title="Active Investigations" value={(Array.isArray(people) ? people : []).filter(p => p.status === 'Being Investigated' || p.status === 'Open').length} subtitle="People under review" color="purple" />
                <DashboardCard iconName="ListChecks" title="Open Tasks" value={openTodos.length} subtitle="Pending to-do items" color="yellow" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    <h3 className="text-xl font-semibold text-slate-700 mb-4">Global Relationship Overview (Placeholder)</h3>
                    <div className="h-[400px] bg-slate-200 rounded-md flex items-center justify-center text-slate-500"><Icon name="Network" className="w-16 h-16 mr-2" /><p>Graph here.</p></div>
                </div>
            </div>
        </div>
    );
  };
  const DashboardCard = ({iconName, title, value, subtitle, color}) => {
    const colors = { blue: 'text-blue-500', green: 'text-green-500', purple: 'text-purple-500', yellow: 'text-yellow-500', };
    return ( <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"> <div className="flex items-center space-x-3 mb-3"> <Icon name={iconName} className={`w-8 h-8 ${colors[color] || 'text-slate-500'}`} /> <h2 className="text-xl font-semibold text-slate-700">{title}</h2> </div> <p className="text-4xl font-bold text-slate-800">{value}</p> <p className="text-sm text-slate-500 mt-1">{subtitle}</p> </div> );
  };

  const PeopleView = () => {
    return (
    <div>
      <Header title="People" />
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
          <div className="relative flex-grow">
            <input type="text" placeholder="Search name, alias, case..." className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 w-full" value={searchTermPeople} onChange={(e) => setSearchTermPeople(e.target.value)} />
            <Icon name="Search" className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          </div>
          <SelectField value={filterPersonCategory} onChange={(e) => setFilterPersonCategory(e.target.value)} options={['All Categories', ...personCategories]} className="w-full sm:w-48" noLabel />
          <SelectField value={filterPersonStatus} onChange={(e) => setFilterPersonStatus(e.target.value)} options={['All Statuses', ...personStatuses]} className="w-full sm:w-48" noLabel />
        </div>
        <button onClick={handleOpenAddPersonModal} className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg shadow hover:from-blue-600 hover:to-blue-700 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 w-full sm:w-auto">
          <Icon name="PlusCircle" /> <span>Add Person</span>
        </button>
      </div>
      {isPeopleLoading && <p className="text-center text-slate-500 py-10">Loading people...</p>}
      {!isPeopleLoading && !error && (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name / Case</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">CRM Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Last Updated</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredPeople.length > 0 ? filteredPeople.map(person => (
                  <tr key={person.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img className="h-10 w-10 rounded-full mr-3 object-cover" src={person.profile_picture_url || `https://placehold.co/40x40/E0E0E0/333?text=${person.name?.substring(0,1) || 'P'}`} alt={person.name} />
                        <div>
                          <div className="text-sm font-medium text-slate-900">{person.name}</div>
                          <div className="text-xs text-slate-500">Case: {person.case_name || 'N/A'}</div>
                          {person.aliases && person.aliases.length > 0 && <div className="text-xs text-slate-500">AKA: {person.aliases.join(', ')}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{person.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ person.status === 'Open' ? 'bg-blue-100 text-blue-800' : person.status === 'Being Investigated' ? 'bg-yellow-100 text-yellow-800' : person.status === 'Completed' ? 'bg-green-100 text-green-800' : person.status === 'Closed' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800' }`}>{person.status}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{person.crm_status}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatDate(person.updated_at)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button onClick={() => handleViewPersonDetails(person)} className="text-blue-600 hover:text-blue-800 transition-colors p-1" title="View Details"><Icon name="Eye" /></button>
                      <button onClick={() => handleOpenEditPersonModal(person)} className="text-indigo-600 hover:text-indigo-800 transition-colors p-1" title="Edit"><Icon name="Edit2" /></button>
                      <button onClick={() => handleDeletePerson(person.id)} className="text-red-600 hover:text-red-800 transition-colors p-1" title="Delete"><Icon name="Trash2" /></button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" className="px-6 py-10 text-center text-slate-500">No people found. Try adding some or check backend connection.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )};

  const ToolsView = () => {
    return (
    <div>
      <Header title="OSINT Tools Directory" />
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
        <div className="relative w-full sm:w-auto">
          <input type="text" placeholder="Search tools by name, category, tag..." className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 w-full sm:w-80" value={searchTermTools} onChange={(e) => setSearchTermTools(e.target.value)} />
          <Icon name="Search" className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
        </div>
        <button onClick={handleOpenAddToolModal} className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg shadow hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 w-full sm:w-auto">
          <Icon name="PlusCircle" /> <span>Add New Tool</span>
        </button>
      </div>
      {isToolsLoading && <p className="text-center text-slate-500 py-10">Loading tools...</p>}
      {!isToolsLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTools.length > 0 ? filteredTools.map(tool => (
              <div key={tool.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col">
                <div className="p-6 flex-grow">
                  <div className="flex justify-between items-start mb-2"> <h3 className="text-xl font-semibold text-slate-800">{tool.name}</h3> <span className={`px-3 py-1 text-xs font-semibold rounded-full ${ tool.status === 'Active' ? 'bg-green-100 text-green-800' : tool.status === 'Deprecated' ? 'bg-red-100 text-red-800' : tool.status === 'Beta' ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-800' }`}>{tool.status}</span> </div>
                  <p className="text-sm text-slate-600 mb-3 h-20 overflow-y-auto">{tool.description}</p>
                  <p className="text-sm text-slate-500 mb-1"><span className="font-medium">Category:</span> {tool.category}</p>
                  {tool.tags && tool.tags.length > 0 && ( <div className="mt-2 mb-3"> {tool.tags.map(tag => ( <span key={tag} className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold mr-2 mb-1 px-2.5 py-0.5 rounded-full">{tag}</span> ))} </div> )}
                  {tool.notes && <p className="text-xs text-slate-500 italic mt-2"><span className="font-medium">Notes:</span> {tool.notes}</p>}
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                  <a href={tool.link} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 hover:text-blue-800 hover:underline transition-colors text-sm font-medium"> <Icon name="Link" className="w-4 h-4 mr-1" /> Visit Tool </a>
                  <div className="space-x-2"> <button onClick={() => handleOpenEditToolModal(tool)} className="text-indigo-600 hover:text-indigo-800 transition-colors p-1" title="Edit"><Icon name="Edit2" className="w-4 h-4"/></button> <button onClick={() => handleDeleteTool(tool.id)} className="text-red-600 hover:text-red-800 transition-colors p-1" title="Delete"><Icon name="Trash2" className="w-4 h-4"/></button> </div>
                </div>
              </div>
            )) : ( <p className="col-span-full text-center py-10 text-slate-500">No tools found. Try adding some!</p> )}
          </div>
        )}
    </div>
  )};
  const SettingsView = () => {
    const [localAppName, setLocalAppName] = useState(appName);
    const [logoFile, setLogoFile] = useState(null);
    const logoInputRef = useRef(null);

    const handleLocalLogoChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { alert("File is too large. Max 5MB allowed."); return; }
            const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'];
            if (!validTypes.includes(file.type)) { alert("Invalid file type. Only JPG, PNG, GIF, SVG allowed."); return; }
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => { setAppLogoFilePreview(reader.result); };
            reader.readAsDataURL(file);
        }
    };
    const handleApplyGeneralSettings = () => {
        setAppName(localAppName);
        if (logoFile) { handleLogoUpload(logoFile); }
        addAuditLogEntry('UPDATE_SETTINGS', 'System', 'General Config', `App name changed to: ${localAppName}`);
        alert("General settings applied!");
    };
    return (
    <div>
        <Header title="Settings" />
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-xl font-semibold text-slate-700 border-b pb-3 mb-6">General Configuration</h3>
                <div className="space-y-6">
                    <InputField label="Application Name" name="localAppName" value={localAppName} onChange={(e) => setLocalAppName(e.target.value)} />
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Application Logo</label>
                        <div className="mt-1 flex items-center space-x-4">
                            {appLogoFilePreview ? ( <img src={appLogoFilePreview} alt="New Logo Preview" className="h-16 w-16 rounded-full object-cover" /> ) : appLogoUrl ? ( <img src={appLogoUrl} alt="Current Logo" className="h-16 w-16 rounded-full object-cover" onError={(e) => e.target.style.display='none'}/> ) : ( <div className="h-16 w-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-500"> <Icon name="Image" className="w-8 h-8" /> </div> )}
                            <input type="file" ref={logoInputRef} className="sr-only" accept="image/png, image/jpeg, image/gif, image/svg+xml" onChange={handleLocalLogoChange} />
                            <button type="button" onClick={() => logoInputRef.current?.click()} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white rounded-md border border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"> Change Logo </button>
                        </div>
                        {isUploadingLogo && <p className="text-sm text-blue-600 mt-2">Uploading logo...</p>}
                    </div>
                    <div className="pt-4"> <button onClick={handleApplyGeneralSettings} disabled={isUploadingLogo} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"> {isUploadingLogo ? 'Saving...' : 'Save General Settings'} </button> </div>
                </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow"> <h3 className="text-xl font-semibold text-slate-700 border-b pb-3 mb-4">Data Model Options</h3> <p className="text-slate-500">Data model customization to be implemented.</p> </div>
            <div className="bg-white p-6 rounded-lg shadow"> <h3 className="text-xl font-semibold text-slate-700 border-b pb-3 mb-4">Data Management</h3> <p className="text-slate-500">Data import/export to be implemented.</p> </div>
            <div className="bg-white p-6 rounded-lg shadow"> <h3 className="text-xl font-semibold text-slate-700 border-b pb-3 mb-4">Audit Log</h3> <p className="text-slate-500">Audit log display to be implemented.</p> </div>
        </div>
    </div>
    );
  };

  const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-2xl" }) => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out">
        <div className={`bg-white rounded-lg shadow-xl w-full ${maxWidth} max-h-[90vh] flex flex-col transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalShow`}>
          <div className="flex justify-between items-center p-5 border-b border-slate-200"> <h3 className="text-xl font-semibold text-slate-700">{title}</h3> <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"> <Icon name="X" className="w-6 h-6" /> </button> </div>
          <div className="p-6 overflow-y-auto">{children}</div>
        </div>
      </div>
    );
  };
  const AddEditPersonForm = ({ person, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
      name: person?.name || '',
      aliases: person?.aliases?.join(', ') || '',
      dateOfBirth: formatInputDate(person?.date_of_birth),
      category: person?.category || (personCategories.length > 0 ? personCategories[0] : ''),
      status: person?.status || (personStatuses.length > 0 ? personStatuses[0] : ''),
      crmStatus: person?.crm_status || (crmStatuses.length > 0 ? crmStatuses[0] : ''),
      caseName: person?.case_name || '',
      profilePictureUrl: person?.profile_picture_url || '',
      notes: person?.notes || '',
    });
    const [currentOsintData, setCurrentOsintData] = useState(person?.osint_data || []);
    const [currentAttachments, setCurrentAttachments] = useState(person?.attachments || []);

    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const addOsintField = () => setCurrentOsintData([...currentOsintData, { id: generateId(), type: osintDataTypes[0], value: '', platform: '', notes: '', url: '' }]);
    const handleOsintFieldChange = (index, field, value) => { const updated = [...currentOsintData]; updated[index][field] = value; setCurrentOsintData(updated); };
    const removeOsintField = (idOrIndex) => setCurrentOsintData(currentOsintData.filter((f, i) => (f.id || i) !== idOrIndex));

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!formData.name.trim()) { alert("Name is required."); return; }
      const dataToSave = {
        ...formData,
        aliases: formData.aliases.split(',').map(a => a.trim()).filter(a => a),
        dateOfBirth: formData.dateOfBirth || null,
        osint_data: currentOsintData,
        attachments: currentAttachments.map(({ fileObject, ...rest }) => rest)
      };
      onSave(dataToSave);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> <InputField label="Full Name" name="name" value={formData.name} onChange={handleChange} required /> <InputField label="Aliases (comma-separated)" name="aliases" value={formData.aliases} onChange={handleChange} /> </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> <InputField label="Date of Birth" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} /> <InputField label="Case Name" name="caseName" value={formData.caseName} onChange={handleChange} list="caseNamesList" /> <datalist id="caseNamesList">{uniqueCaseNames.map(caseN => <option key={caseN} value={caseN} />)}</datalist> </div>
        <InputField label="Profile Picture URL" name="profilePictureUrl" value={formData.profilePictureUrl} onChange={handleChange} placeholder="https://example.com/image.png" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6"> <SelectField label="Category" name="category" value={formData.category} onChange={handleChange} options={personCategories} /> <SelectField label="Status" name="status" value={formData.status} onChange={handleChange} options={personStatuses} /> <SelectField label="CRM Status" name="crmStatus" value={formData.crmStatus} onChange={handleChange} options={crmStatuses} /> </div>
        <div> <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label> <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"></textarea> </div>
        <div className="space-y-4 border-t border-slate-200 pt-4">
            <h4 className="text-md font-semibold text-slate-700">OSINT Data Points</h4>
            {currentOsintData.map((field, index) => ( <div key={field.id || index} className="p-3 border border-slate-200 rounded-md space-y-2 relative"> <button type="button" onClick={() => removeOsintField(field.id || index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700"> <Icon name="Trash2" className="w-4 h-4" /> </button> <SelectField label="Type" value={field.type} onChange={(e) => handleOsintFieldChange(index, 'type', e.target.value)} options={osintDataTypes} small /> { (field.type === 'social_media' || field.type === 'username') && <InputField label="Platform/Site" value={field.platform || ''} onChange={(e) => handleOsintFieldChange(index, 'platform', e.target.value)} small /> } <InputField label={field.type === 'social_media' ? 'Handle/ID' : field.type === 'email' ? 'Email Address' : field.type === 'phone' ? 'Phone Number' : field.type === 'location' ? 'Address/Coordinates' : 'Value'} value={field.value || ''} onChange={(e) => handleOsintFieldChange(index, 'value', e.target.value)} small /> <InputField label="URL (if applicable)" value={field.url || ''} onChange={(e) => handleOsintFieldChange(index, 'url', e.target.value)} small /> <InputField label="Notes" value={field.notes || ''} onChange={(e) => handleOsintFieldChange(index, 'notes', e.target.value)} small /> </div> ))}
            <button type="button" onClick={addOsintField} className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"> <Icon name="PlusCircle" className="w-4 h-4" /> <span>Add OSINT Data Point</span> </button>
        </div>
        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200"> <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors">Cancel</button> <button type="submit" className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-md shadow-sm hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all transform hover:scale-105"> {person ? 'Save Changes' : 'Add Person'} </button> </div>
      </form>
    );
  };
  const PersonDetailModal = ({ person, onClose, onEdit }) => {
    if (!person) return null;
    return (
      <Modal isOpen={!!person} onClose={onClose} title={`Details: ${person.name}`} maxWidth="max-w-4xl">
        <div className="space-y-6">
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
          {person.notes && ( <DetailSection title="Notes"> <p className="text-sm text-slate-700 whitespace-pre-wrap">{person.notes}</p> </DetailSection> )}
          {person.osint_data && person.osint_data.length > 0 && ( <DetailSection title="OSINT Data Points"> <ul className="space-y-3"> {person.osint_data.map((data, index) => ( <li key={data.id || index} className="p-3 bg-slate-50 rounded-md border border-slate-200"> <strong className="capitalize text-sm text-slate-700">{data.type?.replace('_', ' ') || 'Data'}:</strong> {data.platform && <span className="text-sm text-slate-600"> ({data.platform})</span>} <p className="text-sm text-slate-800">{data.url ? <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{data.handle || data.value || data.url}</a> : (data.address || data.value || data.handle)}</p> {data.notes && <p className="text-xs text-slate-500 italic mt-1">{data.notes}</p>} </li> ))} </ul> </DetailSection> )}
          <DetailSection title="Location Map (Placeholder)"> <div className="h-64 bg-slate-200 rounded-md flex items-center justify-center text-slate-500"> <Icon name="MapPin" className="w-10 h-10 mr-2" /> Map visualization will be here. </div> </DetailSection>
          <DetailSection title="Relationship Chart (Placeholder)"> <div className="h-64 bg-slate-200 rounded-md flex items-center justify-center text-slate-500"> <Icon name="Network" className="w-10 h-10 mr-2" /> Relationship graph will be here. </div> </DetailSection>
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200"> <button onClick={() => { onClose(); onEdit(person); }} className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-md shadow-sm hover:from-indigo-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all transform hover:scale-105"> <Icon name="Edit2" className="w-4 h-4 inline-block mr-1" /> Edit Person </button> <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors">Close</button> </div>
        </div>
      </Modal>
    );
  };
  const AddEditToolForm = ({ tool, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
      name: tool?.name || '',
      link: tool?.link || '',
      description: tool?.description || '',
      category: tool?.category || (toolCategories.length > 0 ? toolCategories[0] : ''),
      status: tool?.status || (toolStatuses.length > 0 ? toolStatuses[0] : ''),
      tags: tool?.tags?.join(', ') || '',
      notes: tool?.notes || '',
    });

    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!formData.name.trim()) { alert("Tool Name is required."); return; }
      onSave({ ...formData, tags: formData.tags.split(',').map(t => t.trim()).filter(t => t) });
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <InputField label="Tool Name" name="name" value={formData.name} onChange={handleChange} required />
        <InputField label="Link (URL)" name="link" type="url" value={formData.link} onChange={handleChange} placeholder="https://example.com" />
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Description</label><textarea name="description" value={formData.description} onChange={handleChange} rows="3" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"></textarea></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><SelectField label="Category" name="category" value={formData.category} onChange={handleChange} options={toolCategories} /><SelectField label="Status" name="status" value={formData.status} onChange={handleChange} options={toolStatuses} /></div>
        <InputField label="Tags (comma-separated)" name="tags" value={formData.tags} onChange={handleChange} />
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Notes</label><textarea name="notes" value={formData.notes} onChange={handleChange} rows="2" className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"></textarea></div>
        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200"><button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400">Cancel</button><button type="submit" className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-green-600 rounded-md shadow-sm hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all transform hover:scale-105">{tool ? 'Save Changes' : 'Add Tool'}</button></div>
      </form>
    );
  };
  const AddEditTodoForm = ({ todo, onSave, onCancel }) => {
    const [text, setText] = useState(todo?.text || '');
    const [status, setStatus] = useState(todo?.status || 'open');
    const [last_update_comment, setLastUpdateComment] = useState(todo?.last_update_comment || '');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!text.trim()) { alert("Task description cannot be empty."); return; }
        onSave({ text, status, last_update_comment });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <InputField label="Task Description" name="text" value={text} onChange={(e) => setText(e.target.value)} required />
            <SelectField label="Status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} options={['open', 'done']} />
            <InputField label="Update Comment (Optional)" name="last_update_comment" value={last_update_comment} onChange={(e) => setLastUpdateComment(e.target.value)} />
            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200">Cancel</button>
                <button type="submit" className="px-6 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md">
                    {todo ? 'Save Changes' : 'Add Task'}
                </button>
            </div>
        </form>
    );
  };

  const DetailSection = ({ title, children }) => ( <div className="border-t border-slate-200 pt-4 mt-4"> <h4 className="text-lg font-semibold text-slate-700 mb-3">{title}</h4> {children} </div> );
  const InputField = ({ label, name, type = "text", value, onChange, required, placeholder, small, list, ...props }) => ( <div> {label && <label htmlFor={name} className={`block text-sm font-medium text-slate-700 ${small ? 'mb-0.5' : 'mb-1'}`}>{label}{required && <span className="text-red-500">*</span>}</label>} <input type={type} name={name} id={name} value={value} onChange={onChange} required={required} placeholder={placeholder} list={list} className={`mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${small ? 'p-1.5 text-xs' : 'p-2'}`} {...props} /> </div> );
  const SelectField = ({ label, name, value, onChange, options, required, small, className, noLabel, ...props }) => ( <div className={className}> {!noLabel && <label htmlFor={name} className={`block text-sm font-medium text-slate-700 ${small ? 'mb-0.5' : 'mb-1'}`}>{label}{required && <span className="text-red-500">*</span>}</label>} <select name={name} id={name} value={value} onChange={onChange} required={required} className={`block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${small ? 'p-1.5 text-xs' : 'p-2 h-[38px]'} ${noLabel ? '' : 'mt-1'}`} {...props} > {options.map(opt => <option key={opt} value={opt === 'All Categories' || opt === 'All Statuses' ? '' : opt}>{opt}</option>)} </select> </div> );

  // --- Main Render ---
  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      <style jsx global>{`
        body { margin: 0; font-family: 'Inter', sans-serif; background-color: #f1f5f9; color: #1e293b; }
        /* Leaflet CSS */
        @import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
        /* ReactFlow CSS */
        @import url("https://unpkg.com/reactflow@latest/dist/style.css");

        .leaflet-container { height: 100%; width: 100%; border-radius: 0.375rem; /* Tailwind's rounded-md */ }
        .react-flow__node { font-size: 10px; }
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
