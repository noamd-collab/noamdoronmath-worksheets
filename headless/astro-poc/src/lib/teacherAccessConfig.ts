/** Public Supabase project settings, mirrored from noam-learning-config.js.
 * The parity test prevents drift. This is an anon/publishable key, never a
 * service-role key. Owner entitlement is permanent; sessions still expire.
 * Keep this module server-only: do not include the owner ID in browser data.
 */
export interface TeacherAccessConfig {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly ownerUserId: string;
}

export const TEACHER_ACCESS_CONFIG: Readonly<TeacherAccessConfig> = Object.freeze({
  supabaseUrl: "https://ouzquolkeuceektfihss.supabase.co",
  supabaseAnonKey: "sb_publishable_Ewe0mpYc9LOCRgYSdU4jBA_EnoBCcXe",
  ownerUserId: '80da2957-9492-4a9d-babb-28ba70dedd12',
});
