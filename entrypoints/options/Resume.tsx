import { useEffect, useRef, useState } from 'react';
import { MAX_RESUME_BYTES, fileToResume, getResume, resumeItem, type StoredResume } from '@/lib/resume';

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Resume() {
  const [resume, setResume] = useState<StoredResume | null>(null);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getResume().then(setResume);
  }, []);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_RESUME_BYTES) {
      setError(`That file is ${formatSize(file.size)}. Choose one under ${formatSize(MAX_RESUME_BYTES)}.`);
      return;
    }
    const stored = await fileToResume(file);
    await resumeItem.setValue(stored);
    setResume(stored);
    setError('');
  };

  const onRemove = async () => {
    await resumeItem.setValue(null);
    setResume(null);
  };

  return (
    <section>
      <h2>Resume</h2>
      <p className="muted">
        Attached automatically to resume or CV upload fields when you click <b>Fill this page</b>. Fields that
        already have a file are left alone.
      </p>
      <input ref={fileInput} type="file" accept=".pdf,.doc,.docx,.rtf,.txt,.odt" hidden onChange={onPick} />
      <div className="actions">
        {resume ? (
          <>
            <span className="file-chip">
              {resume.name} <span className="muted">· {formatSize(resume.size)}</span>
            </span>
            <button type="button" onClick={() => fileInput.current?.click()}>Replace</button>
            <button type="button" onClick={onRemove}>Remove</button>
          </>
        ) : (
          <button type="button" className="primary" onClick={() => fileInput.current?.click()}>Upload resume</button>
        )}
        {error && <span className="err">{error}</span>}
      </div>
    </section>
  );
}
