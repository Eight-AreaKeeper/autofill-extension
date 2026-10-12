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
      if (!tab?.id) throw new Error('找不到当前标签页');
      const [res] = await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['/content-scripts/autofill.js'],
      });
      const result = res?.result as FillResult | undefined;
      setState({ kind: 'done', filled: result?.filled ?? 0 });
    } catch (err) {
      // chrome://, the Web Store and other extension pages refuse script injection.
      setState({ kind: 'error', message: '此页面不允许填表（如浏览器内置页、应用商店）' });
      console.error(err);
    }
  };

  return (
    <div className="popup">
      <h1>自动填表助手</h1>

      {hasProfile === false ? (
        <>
          <p className="muted">还没有填写个人信息。</p>
          <button className="primary" onClick={openOptions}>去填写个人信息</button>
        </>
      ) : (
        <>
          <button className="primary" onClick={fill} disabled={state.kind === 'running' || !hasProfile}>
            {state.kind === 'running' ? '填写中…' : '一键填表'}
          </button>
          {state.kind === 'done' &&
            (state.filled > 0 ? (
              <span className="ok">已填写 {state.filled} 个字段，请检查后再提交。</span>
            ) : (
              <span className="muted">没有找到可以填写的空字段。</span>
            ))}
          {state.kind === 'error' && <span className="err">{state.message}</span>}
          <button className="link" onClick={openOptions}>编辑个人信息</button>
        </>
      )}
    </div>
  );
}
