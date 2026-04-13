/**
 * UUID utility helpers.
 * Used to validate IDs before sending them to Supabase which requires UUIDs.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Returns true if the given string is a valid UUID v4.
 */
export function isUuid(id) {
  if (!id || typeof id !== 'string') return false
  return UUID_REGEX.test(id)
}

export default isUuid
