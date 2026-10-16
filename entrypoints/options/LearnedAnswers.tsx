import { useEffect, useState } from 'react';
import { answersItem, getAnswers, getSettings, settingsItem, type LearnedAnswer, type Settings } from '@/lib/learning';

export default function LearnedAnswers() {
  const [answers, setAnswers] = useState<LearnedAnswer[]>([]);
  const [settings, setSettings] = useState<Settings>({ learn: true });

  useEffect(() => {
    getAnswers().then(setAnswers);
    getSettings().then(setSettings);
    // Answers arrive from form pages while this tab is open.
    return answersItem.watch((next) => setAnswers(next ?? []));
  }, []);

  const save = (next: LearnedAnswer[]) => {
    setAnswers(next);
    return answersItem.setValue(next);
  };

  const edit = (id: string, value: string) =>
    save(answers.map((a) => (a.id === id ? { ...a, value, optionValue: undefined, updatedAt: Date.now() } : a)));

  const remove = (id: string) => save(answers.filter((a) => a.id !== id));

  const clearAll = () => {
    if (confirm('Forget all learned answers?')) save([]);
  };

  const toggleLearning = async (learn: boolean) => {
    const next = { ...settings, learn };
    setSettings(next);
    await settingsItem.setValue(next);
  };

  return (
    <section>
      <h2>Learned answers</h2>
      <p className="muted">
        After you click <b>Fill this page</b>, answers you type into questions your details don't cover are
        remembered here and filled in next time the same question comes up. Passwords, card numbers, ID numbers and
        verification codes are never saved.
      </p>
      <label className="toggle">
        <input type="checkbox" checked={settings.learn} onChange={(e) => toggleLearning(e.target.checked)} />
        Learn from what I type
      </label>

      {answers.length === 0 ? (
        <p className="muted">Nothing learned yet.</p>
      ) : (
        <>
          <ul className="answers">
            {answers.map((a) => (
              <li key={`${a.id}:${a.updatedAt}`}>
                <div className="question">
                  {a.question}
                  <span className="muted"> · {a.host}</span>
                </div>
                <div className="answer-row">
                  {a.kind === 'text' && a.value.length > 80 ? (
                    <textarea defaultValue={a.value} rows={3} onBlur={(e) => e.target.value !== a.value && edit(a.id, e.target.value)} />
                  ) : (
                    <input defaultValue={a.value} onBlur={(e) => e.target.value !== a.value && edit(a.id, e.target.value)} />
                  )}
                  <button type="button" onClick={() => remove(a.id)} aria-label={`Forget "${a.question}"`}>Forget</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="actions">
            <button type="button" onClick={clearAll}>Forget all</button>
          </div>
        </>
      )}
    </section>
  );
}
