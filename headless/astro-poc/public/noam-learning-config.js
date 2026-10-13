/* Public browser configuration. Never place service-role or OAuth secrets here. */
window.NOAM_LEARNING_CONFIG = {
  googleEnabled: true,
  url: 'https://ouzquolkeuceektfihss.supabase.co',
  key: 'sb_publishable_Ewe0mpYc9LOCRgYSdU4jBA_EnoBCcXe',
  /**
   * same-origin: OAuth redirectTo = this origin's /learning.html so PKCE verifier
   * in localStorage (storageKey noam-learning-auth-v1) matches the callback origin.
   * GitHub Pages redirect is NOT Headless login.
   * authAllowedOrigins: optional exact origins only (no wildcards). Empty = current origin only.
   */
  authCallbackMode: 'same-origin',
  authAllowedOrigins: [],
  authFixedOrigin: '',
};
