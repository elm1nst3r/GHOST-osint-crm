// File: frontend/src/components/AddEditBusinessForm.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2, MapPin, Building2, User, Users, Phone, Mail, Globe } from 'lucide-react';
import { businessAPI, peopleAPI } from '../utils/api';

const AddEditBusinessForm = ({ business, onSave, onCancel }) => {
  const { t } = useTranslation();
  const [people, setPeople] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    industry: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    latitude: null,
    longitude: null,
    phone: '',
    email: '',
    website: '',
    owner_person_id: null,
    registration_number: '',
    registration_date: '',
    status: 'active',
    employees: [],
    notes: ''
  });
  
  const [newEmployee, setNewEmployee] = useState({ name: '', role: '', department: '', email: '', notes: '' });
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);

  useEffect(() => {
    fetchPeople();
    if (business) {
      setFormData({
        name: business.name || '',
        type: business.type || '',
        industry: business.industry || '',
        address: business.address || '',
        city: business.city || '',
        state: business.state || '',
        country: business.country || '',
        postal_code: business.postal_code || '',
        // DECIMAL columns arrive as strings from the API — coerce so
        // .toFixed() below doesn't crash (issue #53)
        latitude: business.latitude != null ? Number(business.latitude) : null,
        longitude: business.longitude != null ? Number(business.longitude) : null,
        phone: business.phone || '',
        email: business.email || '',
        website: business.website || '',
        owner_person_id: business.owner_person_id,
        registration_number: business.registration_number || '',
        registration_date: business.registration_date ? business.registration_date.split('T')[0] : '',
        status: business.status || 'active',
        employees: business.employees || [],
        notes: business.notes || ''
      });
    }
  }, [business]);

  const fetchPeople = async () => {
    try {
      const { data: peopleList } = await peopleAPI.getAll();
      setPeople(peopleList);
    } catch (error) {
      console.error('Error fetching people:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let savedBusiness;
      if (business) {
        savedBusiness = await businessAPI.update(business.id, formData);
      } else {
        savedBusiness = await businessAPI.create(formData);
      }
      onSave(savedBusiness);
    } catch (error) {
      console.error('Error saving business:', error);
      alert(t('businessForm.errorSaveBusiness', { message: error.message }));
    }
  };

  const addEmployee = () => {
    if (newEmployee.name.trim()) {
      setFormData({
        ...formData,
        employees: [...formData.employees, { ...newEmployee, id: Date.now() }]
      });
      setNewEmployee({ name: '', role: '', department: '', email: '', notes: '' });
      setShowEmployeeForm(false);
    }
  };

  const removeEmployee = (employeeId) => {
    setFormData({
      ...formData,
      employees: formData.employees.filter(emp => emp.id !== employeeId)
    });
  };

  const geocodeAddress = async () => {
    if (!formData.address && !formData.city && !formData.country) {
      alert(t('businessForm.errorEnterAddressToGeocode'));
      return;
    }

    const query = [formData.address, formData.city, formData.state, formData.country]
      .filter(Boolean)
      .join(', ');

    try {
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(query)}`,
        { credentials: 'include' }
      );
      const data = await response.json();

      if (response.ok && data.lat) {
        setFormData({ ...formData, latitude: data.lat, longitude: data.lng });
        alert(t('businessForm.geocodeSuccess'));
      } else {
        let msg = data.message || t('businessForm.geocodeNotFoundFallback');
        if (data.reason === 'not_found') {
          msg += t('businessForm.geocodeTipsNotFound');
        } else if (data.reason === 'timeout') {
          msg += t('businessForm.geocodeTipsTimeout');
        } else if (data.reason === 'rate_limited') {
          msg += t('businessForm.geocodeTipsRateLimited');
        }
        alert(msg);
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      alert(t('businessForm.geocodeServiceUnavailable'));
    }
  };

  const businessTypes = [
    { value: 'Corporation', label: t('businessForm.types.corporation') },
    { value: 'LLC', label: t('businessForm.types.llc') },
    { value: 'Partnership', label: t('businessForm.types.partnership') },
    { value: 'Sole Proprietorship', label: t('businessForm.types.soleProprietorship') },
    { value: 'Non-Profit', label: t('businessForm.types.nonProfit') },
    { value: 'Government', label: t('businessForm.types.government') },
    { value: 'Other', label: t('businessForm.types.other') },
  ];

  const industries = [
    { value: 'Technology', label: t('businessForm.industries.technology') },
    { value: 'Finance', label: t('businessForm.industries.finance') },
    { value: 'Healthcare', label: t('businessForm.industries.healthcare') },
    { value: 'Manufacturing', label: t('businessForm.industries.manufacturing') },
    { value: 'Retail', label: t('businessForm.industries.retail') },
    { value: 'Real Estate', label: t('businessForm.industries.realEstate') },
    { value: 'Construction', label: t('businessForm.industries.construction') },
    { value: 'Transportation', label: t('businessForm.industries.transportation') },
    { value: 'Education', label: t('businessForm.industries.education') },
    { value: 'Entertainment', label: t('businessForm.industries.entertainment') },
    { value: 'Hospitality', label: t('businessForm.industries.hospitality') },
    { value: 'Other', label: t('businessForm.industries.other') },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-gray-600">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
              <Building2 className="w-6 h-6 mr-2" />
              {business ? t('businessForm.editTitle') : t('businessForm.addTitle')}
            </h2>
            <button onClick={onCancel} className="text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3">{t('businessForm.basicInformation')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('businessForm.businessNameRequired')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('businessForm.type')}</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('businessForm.selectType')}</option>
                  {businessTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('businessForm.industry')}</label>
                <select
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('businessForm.selectIndustry')}</option>
                  {industries.map(industry => (
                    <option key={industry.value} value={industry.value}>{industry.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('businessForm.owner')}</label>
                <select
                  value={formData.owner_person_id || ''}
                  onChange={(e) => setFormData({ ...formData, owner_person_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('businessForm.noOwnerSelected')}</option>
                  {people.map(person => (
                    <option key={person.id} value={person.id}>
                      {person.first_name} {person.last_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('businessForm.status')}</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">{t('businessList.statusActive')}</option>
                  <option value="inactive">{t('businessList.statusInactive')}</option>
                  <option value="dissolved">{t('businessList.statusDissolved')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              {t('businessForm.location')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('businessForm.address')}</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('businessForm.streetAddressPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={geocodeAddress}
                    className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    title={t('businessForm.getCoordinates')}
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                </div>
                {formData.latitude && formData.longitude && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {t('businessForm.coordinates', { lat: formData.latitude.toFixed(6), lon: formData.longitude.toFixed(6) })}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder={t('businessForm.cityPlaceholder')}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder={t('businessForm.stateProvincePlaceholder')}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder={t('businessForm.countryPlaceholder')}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  placeholder={t('businessForm.postalCodePlaceholder')}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3">{t('businessForm.contactInformation')}</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={t('businessForm.phonePlaceholder')}
                  className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={t('businessForm.emailPlaceholder')}
                  className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder={t('businessForm.websitePlaceholder')}
                  className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Registration Details */}
          <div>
            <h3 className="text-lg font-semibold mb-3">{t('businessForm.registrationDetails')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={formData.registration_number}
                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                placeholder={t('businessForm.registrationNumberPlaceholder')}
                className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={formData.registration_date}
                onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })}
                className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Employees */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold flex items-center">
                <Users className="w-5 h-5 mr-2" />
                {t('businessForm.employeesCount', { count: formData.employees.length })}
              </h3>
              <button
                type="button"
                onClick={() => setShowEmployeeForm(!showEmployeeForm)}
                className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                {t('businessForm.addEmployee')}
              </button>
            </div>

            {showEmployeeForm && (
              <div className="mb-3 p-3 glass rounded-lg border border-gray-300 dark:border-gray-600">
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <input
                    type="text"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                    placeholder={t('businessForm.namePlaceholder')}
                    className="px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-accent-primary text-sm"
                  />
                  <input
                    type="text"
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                    placeholder={t('businessForm.rolePlaceholder')}
                    className="px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-accent-primary text-sm"
                  />
                  <input
                    type="text"
                    value={newEmployee.department}
                    onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                    placeholder={t('businessForm.departmentPlaceholder')}
                    className="px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-accent-primary text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                    placeholder={t('businessForm.emailPlaceholder')}
                    className="px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-accent-primary text-sm"
                  />
                  <input
                    type="text"
                    value={newEmployee.notes}
                    onChange={(e) => setNewEmployee({ ...newEmployee, notes: e.target.value })}
                    placeholder={t('businessForm.notesPlaceholder')}
                    className="px-3 py-2 glass border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-accent-primary text-sm"
                  />
                </div>
                <div className="flex justify-end space-x-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmployeeForm(false);
                      setNewEmployee({ name: '', role: '', department: '', email: '', notes: '' });
                    }}
                    className="px-3 py-1 text-gray-700 dark:text-slate-300 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-200 text-sm transition-all"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={addEmployee}
                    className="px-3 py-1 bg-blue-600 text-white dark:bg-blue-500 rounded-lg hover:shadow-md text-sm transition-all"
                  >
                    {t('common.add')}
                  </button>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              {formData.employees.map((employee) => (
                <div key={employee.id} className="flex items-center justify-between p-3 glass rounded-lg border border-gray-300 dark:border-gray-600">
                  <div className="flex items-center space-x-3">
                    <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{employee.name}</span>
                        {employee.role && <span className="text-sm text-gray-600 dark:text-gray-400">{t('businessForm.employeeRoleSuffix', { role: employee.role })}</span>}
                        {employee.department && <span className="text-sm text-gray-500 dark:text-gray-500 dark:text-gray-400">{t('businessForm.employeeDepartmentSuffix', { department: employee.department })}</span>}
                      </div>
                      <div className="flex items-center space-x-4 mt-1">
                        {employee.email && (
                          <div className="flex items-center space-x-1">
                            <Mail className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                            <span className="text-xs text-gray-600 dark:text-gray-400">{employee.email}</span>
                          </div>
                        )}
                        {employee.notes && (
                          <span className="text-xs text-gray-500 dark:text-slate-400 italic">{employee.notes}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEmployee(employee.id)}
                    className="text-red-600 hover:text-red-700 transition-colors ml-3"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">{t('businessForm.notes')}</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {business ? t('businessForm.updateBusiness') : t('businessForm.createBusiness')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditBusinessForm;