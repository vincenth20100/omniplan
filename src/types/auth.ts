/**
 * Application user interface — replaces firebase/auth `User` throughout the app.
 * Populated from PocketBase's authStore record.
 */
export interface AppUser {
  /** PocketBase record ID (equivalent to Firebase uid) */
  id: string;
  email: string;
  /** Display name — may be empty string if not set */
  name: string;
  /** URL of the user's avatar image, or null if not set */
  avatarUrl: string | null;
  /** PocketBase JWT token — available after authentication */
  token: string;
}
