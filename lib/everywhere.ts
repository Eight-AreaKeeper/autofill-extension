/** Host access to every site, which lets the extension learn from every form the user fills. */
export const ALL_SITES = { origins: ['<all_urls>'] };

export function hasAllSites(): Promise<boolean> {
  return browser.permissions.contains(ALL_SITES);
}

/** Must be called from a click handler on an extension page. */
export function requestAllSites(): Promise<boolean> {
  return browser.permissions.request(ALL_SITES);
}
