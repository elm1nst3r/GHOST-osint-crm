// File: frontend/src/components/files/FilesPage.js
// Project-level Files section (issue #97): every file in the active project,
// both project-level ones and those attached to people.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Paperclip } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import FilesPanel from './FilesPanel';

const FilesPage = () => {
  const { t } = useTranslation();
  const { activeProjectId, activeProject } = useProject();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Paperclip className="w-6 h-6" />{t('files.pageTitle')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {activeProject ? t('files.pageSubtitle', { project: activeProject.name }) : t('files.pageSubtitleAll')}
        </p>
      </div>
      <FilesPanel key={activeProjectId ?? 'all'} projectId={activeProjectId} showPerson />
    </div>
  );
};

export default FilesPage;
