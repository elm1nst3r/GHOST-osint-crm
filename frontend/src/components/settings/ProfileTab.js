import React, { useState, useEffect } from 'react';
import { Save, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { authAPI } from '../../utils/authAPI';

const ProfileTab = () => {
  const [localCurrentUser, setLocalCurrentUser] = useState(null);
  const [profileForm, setProfileForm] = useState({
    username: '', email: '', first_name: '', last_name: '',
    current_password: '', new_password: '', confirm_password: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    fetchLocalCurrentUser();
  }, []);

  const fetchLocalCurrentUser = async () => {
    try {
      const user = await authAPI.getCurrentUser();
      setLocalCurrentUser(user);
      setProfileForm({
        username: user.username || '', email: user.email || '',
        first_name: user.first_name || '', last_name: user.last_name || '',
        current_password: '', new_password: '', confirm_password: ''
      });
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess(false);

    if (profileForm.new_password) {
      if (!profileForm.current_password) {
        setProfileError('Current password is required to set a new password');
        return;
      }
      if (profileForm.new_password !== profileForm.confirm_password) {
        setProfileError('New passwords do not match');
        return;
      }
      if (profileForm.new_password.length < 6) {
        setProfileError('New password must be at least 6 characters');
        return;
      }
    }

    try {
      setProfileSaving(true);
      const updateData = {
        email: profileForm.email,
        first_name: profileForm.first_name,
        last_name: profileForm.last_name
      };
      if (profileForm.new_password) {
        updateData.current_password = profileForm.current_password;
        updateData.new_password = profileForm.new_password;
      }
      await authAPI.updateProfile(updateData);
      setProfileSuccess(true);
      setProfileForm(prev => ({ ...prev, current_password: '', new_password: '', confirm_password: '' }));
      await fetchLocalCurrentUser();
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (error) {
      setProfileError(error.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">My Profile</h3>
      <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">Update your personal information and change your password.</p>

      <form onSubmit={handleProfileSave} className="space-y-6 max-w-2xl">
        <div className="border-b pb-6">
          <h4 className="text-md font-medium text-gray-900 dark:text-slate-100 mb-4">Account Information</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Username</label>
              <div className="relative">
                <input type="text" value={profileForm.username} disabled className="w-full px-3 py-2 border rounded-md bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 cursor-not-allowed" />
                <Lock className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 dark:text-slate-500" />
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Username cannot be changed</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Email</label>
              <input type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">First Name</label>
                <input type="text" value={profileForm.first_name} onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })} className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Last Name</label>
                <input type="text" value={profileForm.last_name} onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })} className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="border-b pb-6">
          <h4 className="text-md font-medium text-gray-900 dark:text-slate-100 mb-4">Change Password</h4>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">Leave password fields empty if you don't want to change your password.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Current Password</label>
              <input type="password" value={profileForm.current_password} onChange={(e) => setProfileForm({ ...profileForm, current_password: e.target.value })} className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter current password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">New Password</label>
              <input type="password" value={profileForm.new_password} onChange={(e) => setProfileForm({ ...profileForm, new_password: e.target.value })} className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter new password (min. 6 characters)" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Confirm New Password</label>
              <input type="password" value={profileForm.confirm_password} onChange={(e) => setProfileForm({ ...profileForm, confirm_password: e.target.value })} className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Confirm new password" />
            </div>
          </div>
        </div>

        {profileError && (
          <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
            <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />{profileError}
          </div>
        )}
        {profileSuccess && (
          <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-md text-green-800 text-sm">
            <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />Profile updated successfully!
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={profileSaving} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed">
            {profileSaving ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Saving...</> : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileTab;
