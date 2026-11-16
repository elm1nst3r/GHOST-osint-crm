// The "Show in graph" button in the detail dialogs' headers (graph plan,
// phase 4). Same look as its neighbours there.
import { useTranslation } from 'react-i18next';
import { Network } from 'lucide-react';
import { useShowInGraph } from '../utils/useShowInGraph';

export default function ShowInGraphButton({ type, id }) {
  const { t } = useTranslation();
  const showInGraph = useShowInGraph();
  if (!showInGraph || id == null) return null;
  return (
    <button
      type="button"
      onClick={() => showInGraph(type, id)}
      title={t('graph.showInGraph')}
      aria-label={t('graph.showInGraph')}
      className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-accent-ink hover:bg-accent-primary hover:text-white transition-colors"
    >
      <Network className="w-5 h-5" />
    </button>
  );
}
