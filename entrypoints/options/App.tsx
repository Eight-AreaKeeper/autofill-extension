import { useEffect, useState } from 'react';
import { EMPTY_PROFILE, FIELDS, getProfile, saveProfile, type FieldMeta, type Profile } from '@/lib/profile';
import LearnedAnswers from './LearnedAnswers';
import Resume from './Resume';

const GROUPS = [...new Set(FIELDS.map((f) => f.group))];

export default function App() {
  return (
    <main className="options">
      <ProfileForm />
      <Resume />
      <LearnedAnswers />
    </main>
  );
}

function ProfileForm() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [status, setStatus] = useState('');

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  const update = (key: FieldMeta['key'], value: string) => {
    setProfile((p) => ({ ...p, [key]: value }));
    setStatus('');
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProfile(profile);
    setStatus('Saved');
  };

  const onClear = async () => {
    if (!confirm('Clear all your saved details?')) return;
    setProfile(EMPTY_PROFILE);
    await saveProfile(EMPTY_PROFILE);
    setStatus('Cleared');
  };

  return (
    <form onSubmit={onSave}>
      <h1>My details</h1>
      <p className="muted">Stored only in this browser and used for one-click form filling. Empty fields are never filled.</p>

      {GROUPS.map((group) => (
        <fieldset key={group}>
          <legend>{group}</legend>
          <div className="grid">
            {FIELDS.filter((f) => f.group === group).map((f) => (
              <label key={f.key}>
                {f.label}
                <input
                  type={f.type ?? 'text'}
                  value={profile[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => update(f.key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="actions">
        <button type="submit" className="primary">Save</button>
        <button type="button" onClick={onClear}>Clear all</button>
        <span className="ok">{status}</span>
      </div>
    </form>
  );
}
