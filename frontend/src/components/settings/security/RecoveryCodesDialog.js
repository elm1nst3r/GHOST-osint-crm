// File: frontend/src/components/settings/security/RecoveryCodesDialog.js
// Shows new recovery codes once (issue #90). The server keeps only hashes,
// so this is the only time anyone sees them.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LifeBuoy, Copy, Download, Check } from 'lucide-react';
import Dialog, { buttonClass } from './Dialog';

const RecoveryCodesDialog = ({ codes, username, onDone }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const text = codes.join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setSaved(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked: the codes are still on screen */ }
  };

  const download = () => {
    const header = t('security.recovery.fileHeader', { username, date: new Date().toISOString().slice(0, 10) });
    const blob = new Blob([`${header}\n\n${text}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ghost-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  };

  return (
    <Dialog
      title={t('security.recovery.dialogTitle')}
      icon={LifeBuoy}
      footer={
        <button onClick={onDone} className={buttonClass.primary}>
          <Check className="w-4 h-4" />{t('security.recovery.done')}
        </button>
      }
    >
      <p className="text-sm text-gray-700 dark:text-gray-300">{t('security.recovery.dialogIntro')}</p>
      <ul dir="ltr" className="grid grid-cols-2 gap-2 font-mono text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        {codes.map((code) => <li key={code} className="text-gray-900 dark:text-gray-100 select-all">{code}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button onClick={copy} className={buttonClass.small}>
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? t('security.copied') : t('security.copy')}
        </button>
        <button onClick={download} className={buttonClass.small}>
          <Download className="w-4 h-4" />{t('security.recovery.download')}
        </button>
      </div>
      <p className={`text-xs ${saved ? 'text-gray-500 dark:text-gray-400' : 'text-amber-700 dark:text-amber-400'}`}>
        {t('security.recovery.dialogWarning')}
      </p>
    </Dialog>
  );
};

export default RecoveryCodesDialog;
