// What a photo's own metadata says (file-metadata plan): where and when it
// was taken, on what device, by whom. Shown beside the preview. The position
// can be added to the person the file belongs to, or shown on the map.
import { lazy, Suspense, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { MapPin, Camera, Clock, Fingerprint, Copy, Check, Plus, Map as MapIcon, Loader2 } from 'lucide-react';
import { peopleAPI } from '../../utils/api';
import { formatDate } from '../../utils/format';
import { useModules } from '../../contexts/ModulesContext';
import { formatPersonName } from '../../utils/personName';
import {
  takenAtParts, hasLocation, coordinates, compassPoint, metadataRows, locationFromPhoto,
} from '../../utils/photoMetadata';

const PhotoMap = lazy(() => import('./PhotoMap'));

const Section = ({ icon: Icon, title, children }) => (
  <section className="space-y-1.5">
    <h3 className="flex items-center gap-x-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      <Icon className="w-3.5 h-3.5" />{title}
    </h3>
    {children}
  </section>
);

const PhotoMetadata = ({ file, onNavigate }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isOn } = useModules();
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const [adding, startAdding] = useTransition();
  const meta = file.metadata;
  if (!meta) return null;

  const gps = hasLocation(file) ? meta.gps : null;
  const taken = takenAtParts(meta.taken_at);
  const rows = metadataRows(meta);
  const person = file.person_id
    ? formatPersonName({ first_name: file.person_first_name, patronymic: file.person_patronymic, last_name: file.person_last_name }, `#${file.person_id}`)
    : null;
  const takenText = taken ? `${formatDate(taken.date)} ${taken.time}` : '';

  const copy = () => {
    navigator.clipboard.writeText(coordinates(gps))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })
      .catch(() => {});
  };

  const addLocation = () => startAdding(async () => {
    try {
      await peopleAPI.addLocation(file.person_id, locationFromPhoto(file, {
        label: t('photoMeta.locationLabel', { name: file.original_name }),
        notes: takenText
          ? t('photoMeta.locationNotesTaken', { name: file.original_name, date: takenText })
          : t('photoMeta.locationNotes', { name: file.original_name }),
      }));
      setError('');
      setAdded(true);
    } catch (err) {
      setError(err.message);
    }
  });

  const showOnMap = () => {
    onNavigate?.();
    navigate(`/map?photo=${file.id}`);
  };

  return (
    <div className="space-y-5 text-sm" data-testid="photo-metadata">
      {gps && (
        <Section icon={MapPin} title={t('photoMeta.where')}>
          <Suspense fallback={<div className="h-[180px] rounded-md bg-gray-100 dark:bg-gray-700" />}>
            <PhotoMap latitude={gps.latitude} longitude={gps.longitude} />
          </Suspense>
          <div className="flex items-center gap-x-2">
            <span className="font-mono text-xs text-gray-800 dark:text-gray-200" dir="ltr">{coordinates(gps)}</span>
            <button type="button" onClick={copy} title={t('photoMeta.copyCoordinates')} aria-label={t('photoMeta.copyCoordinates')} className="p-1 rounded-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200">
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          {(gps.altitude != null || gps.direction != null) && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {[
                gps.altitude != null && t('photoMeta.altitude', { value: gps.altitude }),
                gps.direction != null && t('photoMeta.direction', { value: Math.round(gps.direction), point: compassPoint(gps.direction) }),
              ].filter(Boolean).join(' · ')}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {file.person_id && (
              added ? (
                <span className="inline-flex items-center gap-x-1 text-xs text-green-700 dark:text-green-400">
                  <Check className="w-3.5 h-3.5" />{t('photoMeta.locationAdded', { name: person })}
                </span>
              ) : (
                <button type="button" onClick={addLocation} disabled={adding} className="inline-flex items-center gap-x-1 px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60">
                  {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  {t('photoMeta.addLocation', { name: person })}
                </button>
              )
            )}
            {isOn('map') && (
              <button type="button" onClick={showOnMap} className="inline-flex items-center gap-x-1 px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                <MapIcon className="w-3.5 h-3.5" />{t('photoMeta.showOnMap')}
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </Section>
      )}

      {taken && (
        <Section icon={Clock} title={t('photoMeta.when')}>
          <p className="text-gray-900 dark:text-gray-100">{takenText}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {taken.offset ? t('photoMeta.timeZone', { offset: taken.offset }) : t('photoMeta.noTimeZone')}
          </p>
        </Section>
      )}

      {rows.length > 0 && (
        <Section icon={Camera} title={t('photoMeta.details')}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {rows.map((row) => (
              <div key={row.key} className="contents">
                <dt className="text-xs text-gray-500 dark:text-gray-400 pt-0.5">{t(`photoMeta.fields.${row.key}`)}</dt>
                <dd className="min-w-0 text-gray-900 dark:text-gray-100 wrap-break-word">
                  <bdi dir="auto">{row.value}</bdi>
                  {row.identifying && (
                    <span className="ms-1.5 inline-flex items-center gap-x-0.5 text-[11px] text-amber-700 dark:text-amber-400" title={t('photoMeta.identifyingHint')}>
                      <Fingerprint className="w-3 h-3" />{t('photoMeta.identifying')}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">{t('photoMeta.caveat')}</p>
    </div>
  );
};

export default PhotoMetadata;
