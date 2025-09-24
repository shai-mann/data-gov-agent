const FIELD_NAMES_TO_REDACT = ['id', 'tool_call_id'];

/**
 * Redact invocation IDs from an object. This is useful for making agent invocation snapshots reproducible.
 * @param obj - The object to redact
 * @returns The redacted object
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function redactInvocationIds(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactInvocationIds);
  }

  const redacted = { ...obj };

  // Redact common ID fields
  for (const field of FIELD_NAMES_TO_REDACT) {
    if (redacted[field] && typeof redacted[field] === 'string') {
      if (redacted[field].startsWith('chatcmpl-')) {
        redacted[field] = 'chatcmpl-REDACTED';
      } else if (redacted[field].startsWith('call_')) {
        redacted[field] = 'call_REDACTED';
      } else if (redacted[field].startsWith('req_')) {
        redacted[field] = 'req_REDACTED';
      } else {
        redacted[field] = 'REDACTED';
      }
    }
  }

  // Recursively process nested objects
  for (const key in redacted) {
    if (redacted[key] && typeof redacted[key] === 'object') {
      redacted[key] = redactInvocationIds(redacted[key]);
    }
  }

  return redacted;
}
