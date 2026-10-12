import { useEffect, useState } from 'react';
import { EMPTY_PROFILE, FIELDS, getProfile, saveProfile, type FieldMeta, type Profile } from '@/lib/profile';

const GROUPS = [...new Set(FIELDS.map((f) => f.group))];

export default function App() {
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
    setStatus('已保存');
  };

  const onClear = async () => {
    if (!confirm('确定清空所有个人信息吗？')) return;
    setProfile(EMPTY_PROFILE);
    await saveProfile(EMPTY_PROFILE);
    setStatus('已清空');
  };

  return (
    <form className="options" onSubmit={onSave}>
      <h1>个人信息</h1>
      <p className="muted">这些信息只保存在本机浏览器中，用于一键填表。留空的项不会填写。</p>

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
        <button type="submit" className="primary">保存</button>
        <button type="button" onClick={onClear}>清空</button>
        <span className="ok">{status}</span>
      </div>
    </form>
  );
}
