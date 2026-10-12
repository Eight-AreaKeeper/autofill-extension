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
  group: 'Personal' | 'Contact' | 'Work' | 'Address';
  type?: 'text' | 'email' | 'tel' | 'date' | 'url';
  placeholder?: string;
}

/** Field order here drives the options page layout. */
export const FIELDS: FieldMeta[] = [
  { key: 'fullName', label: 'Full name', group: 'Personal', placeholder: 'Jane Doe' },
  { key: 'firstName', label: 'First name', group: 'Personal', placeholder: 'Jane' },
  { key: 'lastName', label: 'Last name', group: 'Personal', placeholder: 'Doe' },
  { key: 'gender', label: 'Gender', group: 'Personal', placeholder: 'Female / Male' },
  { key: 'birthday', label: 'Date of birth', group: 'Personal', type: 'date' },
  { key: 'email', label: 'Email', group: 'Contact', type: 'email', placeholder: 'jane@example.com' },
  { key: 'phone', label: 'Phone', group: 'Contact', type: 'tel', placeholder: '+1 555 123 4567' },
  { key: 'website', label: 'Website', group: 'Contact', type: 'url', placeholder: 'https://' },
  { key: 'company', label: 'Company', group: 'Work' },
  { key: 'jobTitle', label: 'Job title', group: 'Work' },
  { key: 'street', label: 'Street address', group: 'Address', placeholder: '123 Main St, Apt 4' },
  { key: 'city', label: 'City', group: 'Address', placeholder: 'San Francisco' },
  { key: 'district', label: 'District / County', group: 'Address' },
  { key: 'province', label: 'State / Province', group: 'Address', placeholder: 'California' },
  { key: 'postalCode', label: 'ZIP / Postal code', group: 'Address', placeholder: '94105' },
  { key: 'country', label: 'Country', group: 'Address', placeholder: 'United States' },
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

/** Fill in derived values, e.g. split a full name into first/last when only one side is set. */
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
