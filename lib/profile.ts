import { storage } from 'wxt/utils/storage';

export type ProfileKey =
  | 'fullName'
  | 'lastName'
  | 'firstName'
  | 'gender'
  | 'birthday'
  | 'email'
  | 'phone'
  | 'company'
  | 'jobTitle'
  | 'country'
  | 'province'
  | 'city'
  | 'district'
  | 'street'
  | 'postalCode'
  | 'website';

export type Profile = Record<ProfileKey, string>;

export interface FieldMeta {
  key: ProfileKey;
  label: string;
  group: '基本信息' | '联系方式' | '工作' | '地址';
  type?: 'text' | 'email' | 'tel' | 'date' | 'url';
  placeholder?: string;
}

/** Field order here drives the options page layout. */
export const FIELDS: FieldMeta[] = [
  { key: 'fullName', label: '姓名', group: '基本信息', placeholder: '张三' },
  { key: 'lastName', label: '姓', group: '基本信息', placeholder: '张' },
  { key: 'firstName', label: '名', group: '基本信息', placeholder: '三' },
  { key: 'gender', label: '性别', group: '基本信息', placeholder: '男 / 女' },
  { key: 'birthday', label: '出生日期', group: '基本信息', type: 'date' },
  { key: 'email', label: '邮箱', group: '联系方式', type: 'email', placeholder: 'name@example.com' },
  { key: 'phone', label: '手机号', group: '联系方式', type: 'tel', placeholder: '13800000000' },
  { key: 'website', label: '个人网站', group: '联系方式', type: 'url' },
  { key: 'company', label: '公司', group: '工作' },
  { key: 'jobTitle', label: '职位', group: '工作' },
  { key: 'country', label: '国家/地区', group: '地址', placeholder: '中国' },
  { key: 'province', label: '省份', group: '地址', placeholder: '广东省' },
  { key: 'city', label: '城市', group: '地址', placeholder: '深圳市' },
  { key: 'district', label: '区/县', group: '地址', placeholder: '南山区' },
  { key: 'street', label: '详细地址', group: '地址', placeholder: '街道、门牌号' },
  { key: 'postalCode', label: '邮编', group: '地址', placeholder: '518000' },
];

export const EMPTY_PROFILE: Profile = Object.fromEntries(
  FIELDS.map((f) => [f.key, '']),
) as Profile;

export const profileItem = storage.defineItem<Profile>('local:profile', {
  fallback: EMPTY_PROFILE,
});

export async function getProfile(): Promise<Profile> {
  return { ...EMPTY_PROFILE, ...(await profileItem.getValue()) };
}

export function saveProfile(profile: Profile): Promise<void> {
  return profileItem.setValue(profile);
}

/** Fill in derived values, e.g. split 姓名 into 姓/名 when only one side is set. */
export function withDerived(p: Profile): Profile {
  const out = { ...p };
  if (!out.fullName && (out.lastName || out.firstName)) {
    out.fullName = /[一-龥]/.test(out.lastName + out.firstName)
      ? out.lastName + out.firstName
      : [out.firstName, out.lastName].filter(Boolean).join(' ');
  }
  if (out.fullName && !out.lastName && !out.firstName) {
    const name = out.fullName.trim();
    if (/^[一-龥]{2,4}$/.test(name)) {
      out.lastName = name.slice(0, 1);
      out.firstName = name.slice(1);
    } else if (name.includes(' ')) {
      const parts = name.split(/\s+/);
      out.firstName = parts[0] ?? '';
      out.lastName = parts.slice(1).join(' ');
    }
  }
  return out;
}
