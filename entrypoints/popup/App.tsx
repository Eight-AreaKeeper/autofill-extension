import { useEffect, useState } from 'react';
import type { FillResult } from '@/lib/filler';
import { hasAllSites } from '@/lib/everywhere';
import { getAnswers, getSettings } from '@/lib/learning';
import { getProfile } from '@/lib/profile';
import { getResume } from '@/lib/resume';

type State =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; result: FillResult }
  | { kind: 'error'; message: string };

export default function App() {
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [learnsEverywhere, setLearnsEverywhere] = useState(true);

  useEffect(() => {
    Promise.all([getSettings(), hasAllSites()]).then(([s, all]) => setLearnsEverywhere(!s.learn || all));
    Promise.all([getProfile(), getAnswers(), getResume()]).then(([p, answers, resume]) =>
      setHasProfile(Object.values(p).some(Boolean) || answers.length > 0 || !!resume),
    );
  }, []);

  const openOptions = () => browser.runtime.openOptionsPage();

  const fill = async () => {
    setState({ kind: 'running' });
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      const [res] = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['/content-scripts/autofill.js'],
      });
      const result = (res?.result as FillResult | undefined) ?? { filled: 0, fields: [], fromLearned: 0, resumes: 0 };
      setState({ kind: 'done', result });
    } catch (err) {
      // chrome://, the Web Store and other extension pages refuse script injection.
      setState({ kind: 'error', message: "Forms can't be filled on this page (browser settings pages and the Web Store are off-limits)." });
      console.error(err);
    }
  };

  return (
    <div className="popup">
      <h1>Autofill Assistant</h1>

      {hasProfile === false ? (
        <>
          <p className="muted">You haven't saved any details yet.</p>
          <button className="primary" onClick={openOptions}>Add my details</button>
        </>
      ) : (
        <>
          <button className="primary" onClick={fill} disabled={state.kind === 'running' || !hasProfile}>
            {state.kind === 'running' ? 'Filling…' : 'Fill this page'}
          </button>
          {state.kind === 'done' &&
            (state.result.filled > 0 || state.result.resumes > 0 ? (
              <span className="ok">{summary(state.result)} Review them before you submit.</span>
            ) : (
              <span className="muted">Didn't find any empty fields it could fill.</span>
            ))}
          {state.kind === 'error' && <span className="err">{state.message}</span>}
          {!learnsEverywhere && (
            <button className="link" onClick={openOptions}>Learn from every form, not just this page</button>
          )}
          <button className="link" onClick={openOptions}>Edit my details</button>
        </>
      )}
    </div>
  );
}

function summary({ filled, fromLearned, resumes }: FillResult): string {
  const parts: string[] = [];
  if (filled > 0) {
    parts.push(`Filled ${filled} ${filled === 1 ? 'field' : 'fields'}` + (fromLearned > 0 ? ` (${fromLearned} from answers you gave before)` : ''));
  }
  if (resumes > 0) parts.push('attached your resume');
  const text = parts.join(' and ');
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}
