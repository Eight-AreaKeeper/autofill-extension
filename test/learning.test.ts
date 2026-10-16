import { beforeEach, describe, expect, it } from 'vitest';
import { fillPage } from '@/lib/filler';
import { captureAnswer, findAnswer, normalizeQuestion, questionText, upsertAnswer, type LearnedAnswer } from '@/lib/learning';
import { EMPTY_PROFILE } from '@/lib/profile';
import { accepts, attachResume, isResumeInput, resumeToFile, type StoredResume } from '@/lib/resume';

const $ = <T extends Element = HTMLInputElement>(sel: string) => document.querySelector<T>(sel)! as T;

const APPLICATION = `
  <form>
    <label for="name">Full name</label><input id="name" />
    <label for="auth">Are you legally authorized to work in the United States?</label>
    <select id="auth"><option value="">Select…</option><option value="1">Yes</option><option value="0">No</option></select>
    <div class="q">How did you hear about this job?</div><div><input id="source" name="question_48213" /></div>
    <fieldset><legend>Will you now or in the future require visa sponsorship?</legend>
      <label><input type="radio" name="spon" value="y" />Yes</label>
      <label><input type="radio" name="spon" value="n" />No</label>
    </fieldset>
    <label for="why">Why do you want to work here? (optional)</label><textarea id="why"></textarea>
    <label for="pw">Password</label><input id="pw" type="text" />
    <label for="ssn">Social Security Number</label><input id="ssn" />
    <label for="other">Other</label><input id="other" />
    <input type="search" id="q" aria-label="Search jobs" />
  </form>`;

beforeEach(() => {
  document.body.innerHTML = APPLICATION;
  HTMLElement.prototype.getClientRects = function (this: HTMLElement) {
    return (this.style.display === 'none' ? [] : [{}]) as unknown as DOMRectList;
  };
});

/** Simulate the user answering the application, then collect what would be learned. */
function answerAndLearn(): LearnedAnswer[] {
  $<HTMLSelectElement>('#auth').value = '1';
  $('#source').value = 'LinkedIn';
  $('input[name=spon][value=n]').checked = true;
  $<HTMLTextAreaElement>('#why').value = 'I like the mission.';
  $('#pw').value = 'hunter2';
  $('#ssn').value = '123-45-6789';
  $('#other').value = 'something';
  $('#q').value = 'engineer';
  $('#name').value = 'Jane Doe';

  let list: LearnedAnswer[] = [];
  for (const el of document.querySelectorAll<HTMLInputElement>('input, select, textarea')) {
    const a = captureAnswer(el, 'jobs.example.com');
    if (a) list = upsertAnswer(list, a);
  }
  return list;
}

describe('questionText', () => {
  it('reads labels, nearby captions and legends, but not machine-generated names', () => {
    expect(questionText($('#auth'))).toBe('Are you legally authorized to work in the United States?');
    expect(questionText($('#source'))).toBe('How did you hear about this job?');
    expect(questionText($('input[name=spon]'))).toBe('Will you now or in the future require visa sponsorship?');
    document.body.innerHTML = '<input name="question_48213" />';
    expect(questionText($('input'))).toBe('');
  });
});

describe('captureAnswer', () => {
  it('learns answers to uncovered questions and skips sensitive, vague and profile fields', () => {
    const learned = answerAndLearn();
    expect(learned.map((a) => [a.question, a.value]).sort()).toEqual(
      [
        ['Are you legally authorized to work in the United States?', 'Yes'],
        ['How did you hear about this job?', 'LinkedIn'],
        ['Why do you want to work here? (optional)', 'I like the mission.'],
        ['Will you now or in the future require visa sponsorship?', 'No'],
      ].sort(),
    );
  });

  it('keeps one answer per question, newest first', () => {
    const a = captureAnswer(Object.assign($('#source'), { value: 'LinkedIn' }), 'a.com')!;
    const b = captureAnswer(Object.assign($('#source'), { value: 'A friend' }), 'b.com')!;
    const list = upsertAnswer(upsertAnswer([], a), b);
    expect(list).toHaveLength(1);
    expect(list[0]!.value).toBe('A friend');
  });
});

describe('findAnswer', () => {
  const answers = [
    { norm: normalizeQuestion('Are you legally authorized to work in the United States?') },
    { norm: normalizeQuestion('Pronouns') },
  ] as LearnedAnswer[];

  it('matches reworded long questions but only exact short ones', () => {
    expect(findAnswer(answers, normalizeQuestion('Are you legally authorized to work in the United States? *'), 'exact')).toBe(answers[0]);
    expect(findAnswer(answers, normalizeQuestion('Are you authorized to work in the United States?'), 'similar')).toBe(answers[0]);
    expect(findAnswer(answers, normalizeQuestion('Are you authorized to work in Canada?'), 'similar')).toBeUndefined();
    expect(findAnswer(answers, normalizeQuestion('Your pronouns'), 'similar')).toBeUndefined();
  });
});

describe('fillPage with learned answers', () => {
  it('fills a new form from what was learned on the last one', () => {
    const answers = answerAndLearn();
    document.body.innerHTML = APPLICATION;
    const res = fillPage({ ...EMPTY_PROFILE, fullName: 'Jane Doe' }, document, { answers });

    expect($('#name').value).toBe('Jane Doe');
    expect($<HTMLSelectElement>('#auth').value).toBe('1');
    expect($('#source').value).toBe('LinkedIn');
    expect($('input[name=spon][value=n]').checked).toBe(true);
    expect($<HTMLTextAreaElement>('#why').value).toBe('I like the mission.');
    for (const sel of ['#pw', '#ssn', '#other', '#q']) expect($(sel).value, sel).toBe('');
    expect(res.filled).toBe(5);
    expect(res.fromLearned).toBe(4);
  });

  it('lets an answer to the exact question override a keyword match', () => {
    document.body.innerHTML = '<label for="c">Have you ever worked for this company before?</label><input id="c" />';
    const answers = [captureAnswer(Object.assign($('#c'), { value: 'No' }), 'x.com')!];
    expect(answers[0]).toBeTruthy();
    $('#c').value = '';
    fillPage({ ...EMPTY_PROFILE, company: 'Acme Inc.' }, document, { answers });
    expect($('#c').value).toBe('No');
  });
});

describe('resume upload', () => {
  const resume: StoredResume = {
    name: 'Jane Doe Resume.pdf',
    type: 'application/pdf',
    size: 5,
    data: btoa('%PDF-'),
    updatedAt: 0,
  };

  it('recognizes resume inputs, including hidden ones, but not cover letters or photos', () => {
    document.body.innerHTML = `
      <label for="r">Resume/CV</label><input type="file" id="r" />
      <div class="upload"><span>Attach your CV</span><input type="file" id="hidden" style="display:none" /></div>
      <label for="cl">Cover letter</label><input type="file" id="cl" />
      <label for="ph">Profile photo</label><input type="file" id="ph" accept="image/*" />`;
    expect(isResumeInput($('#r'))).toBe(true);
    expect(isResumeInput($('#hidden'))).toBe(true);
    expect(isResumeInput($('#cl'))).toBe(false);
    expect(isResumeInput($('#ph'))).toBe(false);
  });

  it('checks the accept list', () => {
    document.body.innerHTML = '<input type="file" id="a" accept=".pdf,.docx" /><input type="file" id="b" accept="image/*" />';
    expect(accepts($('#a'), resume.name, resume.type)).toBe(true);
    expect(accepts($('#b'), resume.name, resume.type)).toBe(false);
  });

  it('round-trips the stored file', async () => {
    const file = resumeToFile(resume);
    expect(file.name).toBe('Jane Doe Resume.pdf');
    expect(await file.text()).toBe('%PDF-');
  });

  it('attaches the resume and fires change', () => {
    document.body.innerHTML = '<label for="r">Resume</label><input type="file" id="r" /><label for="cl">Cover letter</label><input type="file" id="cl" />';
    let changed = false;
    $('#r').addEventListener('change', () => (changed = true));
    expect(attachResume(resume)).toBe(1);
    expect($('#r').files?.[0]?.name).toBe('Jane Doe Resume.pdf');
    expect($('#cl').files?.length ?? 0).toBe(0);
    expect(changed).toBe(true);
  });
});
