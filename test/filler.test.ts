import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { fillPage } from '@/lib/filler';
import { matchField } from '@/lib/matcher';
import { EMPTY_PROFILE, type Profile } from '@/lib/profile';

export const TEST_PROFILE: Profile = {
  ...EMPTY_PROFILE,
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+1 555 123 4567',
  gender: 'Female',
  birthday: '1990-05-17',
  company: 'Acme Inc.',
  jobTitle: 'Engineer',
  street: '123 Main St',
  city: 'San Francisco',
  province: 'CA',
  postalCode: '94105',
  country: 'United States',
};

const $ = <T extends Element = HTMLInputElement>(sel: string) => document.querySelector<T>(sel)! as T;

beforeEach(() => {
  const html = readFileSync(resolve(__dirname, 'sample-form.html'), 'utf8');
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
  // Scripts don't run through innerHTML, so wire up the page's input listener here.
  document.getElementById('r-name')!.addEventListener('input', (e) => {
    document.getElementById('r-echo')!.textContent = 'yes: ' + (e.target as HTMLInputElement).value;
  });
  // happy-dom has no layout: treat everything as visible except display:none.
  HTMLElement.prototype.getClientRects = function (this: HTMLElement) {
    return (this.style.display === 'none' ? [] : [{}]) as unknown as DOMRectList;
  };
});

describe('matchField', () => {
  it('prefers autocomplete, then labels and attributes', () => {
    expect(matchField($('[autocomplete="shipping postal-code"]'))).toBe('postalCode');
    expect(matchField($('#f-name'))).toBe('fullName');
    expect(matchField($('[name=first_name]'))).toBe('firstName');
    expect(matchField($('#f-line2'))).toBeNull();
    expect(matchField($('[name=middle_name]'))).toBeNull();
    expect(matchField($('[name=username]'))).toBeNull();
    expect(matchField($('#c-name'))).toBe('fullName');
  });
});

describe('fillPage', () => {
  it('fills the sample form', () => {
    const res = fillPage(TEST_PROFILE);
    const value = (sel: string) => $(sel).value;

    expect(value('#f-name')).toBe('Jane Doe');
    expect(value('#f-email')).toBe('jane@example.com');
    expect(value('#f-phone')).toBe('+1 555 123 4567');
    expect(value('#f-dob')).toBe('1990-05-17');
    expect($('input[name=gender][value=female]').checked).toBe(true);
    expect(value('#f-street')).toBe('123 Main St');
    expect(value('#f-city')).toBe('San Francisco');
    expect(value('#f-state')).toBe('CA');
    expect(value('#f-zip')).toBe('94105');
    expect(value('#f-country')).toBe('US');

    // First/last are derived from the full name.
    expect(value('[name=first_name]')).toBe('Jane');
    expect(value('[name=last_name]')).toBe('Doe');
    expect(value('[name=contact]')).toBe('jane@example.com');
    expect(value('[autocomplete="shipping postal-code"]')).toBe('94105');
    expect(value('[name=company]')).toBe('Acme Inc.');
    expect(value('[name=position]')).toBe('Engineer');

    expect(value('#t-mobile')).toBe('+1 555 123 4567');
    expect(value('#t-city')).toBe('San Francisco');
    expect(value('#t-company')).toBe('Acme Inc.');
    expect($('#r-echo').textContent).toBe('yes: Jane Doe');

    expect(value('#c-name')).toBe('Jane Doe');
    expect(value('#c-phone')).toBe('+1 555 123 4567');
    expect(value('#c-zip')).toBe('94105');
    expect($('input[name=xb][value=女]').checked).toBe(true);

    for (const sel of ['#f-line2', '[name=middle_name]', '[name=username]', '[name=password]', '[name=q]', '[name=email2]']) {
      expect(value(sel), sel).toBe('');
    }
    expect(value('#t-prefilled')).toBe('000-0000');
    expect(res.filled).toBe(24);
  });

  it('fills nothing new on a second run', () => {
    fillPage(TEST_PROFILE);
    expect(fillPage(TEST_PROFILE).filled).toBe(0);
  });

  it('matches Chinese option text and state abbreviations', () => {
    document.body.innerHTML = `
      <label for="p">省份</label><select id="p"><option value="">请选择</option><option>广东</option></select>
      <label for="s">State</label><select id="s"><option value="">-</option><option>CA</option><option>NY</option></select>`;
    fillPage({ ...EMPTY_PROFILE, province: '广东省' });
    expect($<HTMLSelectElement>('#p').value).toBe('广东');
    document.querySelector<HTMLSelectElement>('#s')!.selectedIndex = 0;
    fillPage({ ...EMPTY_PROFILE, province: 'California' });
    expect($<HTMLSelectElement>('#s').value).toBe('CA');
  });
});
