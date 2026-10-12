import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { fillPage } from '@/lib/filler';
import { matchField } from '@/lib/matcher';
import { EMPTY_PROFILE, type Profile } from '@/lib/profile';

const profile: Profile = {
  ...EMPTY_PROFILE,
  fullName: '张三',
  email: 'zhangsan@example.com',
  phone: '13800000000',
  gender: '男',
  company: '示例科技',
  province: '广东省',
  city: '深圳市',
  street: '科技园路 1 号',
  postalCode: '518000',
};

const $ = (sel: string) => document.querySelector<HTMLInputElement>(sel)!;

beforeEach(() => {
  const html = readFileSync(resolve(__dirname, 'sample-form.html'), 'utf8');
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
  // happy-dom has no layout, so pretend everything is visible.
  HTMLElement.prototype.getClientRects = () => [{}] as unknown as DOMRectList;
});

describe('matchField', () => {
  it('prefers autocomplete, then labels and attributes', () => {
    expect(matchField($('[autocomplete="shipping postal-code"]'))).toBe('postalCode');
    expect(matchField($('#xm'))).toBe('fullName');
    expect(matchField($('[name=first_name]'))).toBe('firstName');
    expect(matchField($('[name=username]'))).toBeNull();
  });
});

describe('fillPage', () => {
  it('fills the sample form', () => {
    const res = fillPage(profile);
    expect($('#xm').value).toBe('张三');
    expect($('#sj').value).toBe('13800000000');
    expect($('#yx').value).toBe('zhangsan@example.com');
    expect(document.querySelector<HTMLSelectElement>('#sf')!.value).toBe('广东');
    expect($('#yb').value).toBe('518000');
    expect($('input[name=xb][value=男]').checked).toBe(true);
    // Derived from 张三.
    expect($('[name=first_name]').value).toBe('三');
    expect($('[name=last_name]').value).toBe('张');
    expect($('[name=contact]').value).toBe('zhangsan@example.com');
    const tableInputs = document.querySelectorAll<HTMLInputElement>('table input');
    expect([...tableInputs].map((i) => i.value)).toEqual(['13800000000', '深圳市', '示例科技']);
    expect($('[name=username]').value).toBe('');
    expect($('[name=password]').value).toBe('');
    expect(res.filled).toBeGreaterThanOrEqual(14);
  });

  it('does not overwrite existing values', () => {
    $('#xm').value = '李四';
    fillPage(profile);
    expect($('#xm').value).toBe('李四');
  });
});
