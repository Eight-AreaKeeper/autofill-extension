import { useEffect, useState } from 'react';
import type { FillResult } from '@/lib/filler';
import { getProfile } from '@/lib/profile';

type State =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; filled: number }
  | { kind: 'error'; message: string };

export default function App() {
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [state, setState] = useState<State>({ kind: 'idle' });

  useEffect(() => {
    getProfile().then((p) => setHasProfile(Object.values(p).some(Boolean)));
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
      const result = res?.result as FillResult | undefined;
      setState({ kind: 'done', filled: result?.filled ?? 0 });
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
            (state.filled > 0 ? (
              <span className="ok">Filled {state.filled} {state.filled === 1 ? 'field' : 'fields'}. Review them before you submit.</span>
            ) : (
              <span className="muted">Didn't find any empty fields it could fill.</span>
            ))}
          {state.kind === 'error' && <span className="err">{state.message}</span>}
          <button className="link" onClick={openOptions}>Edit my details</button>
        </>
      )}
    </div>
  );
}
