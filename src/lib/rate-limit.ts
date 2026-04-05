// Simple client-side rate limiting to prevent rapid form submissions
const submissionHistory: Record<string, number[]> = {};

export const checkRateLimit = (action: string, limit: number = 5, windowMs: number = 60000): boolean => {
  const now = Date.now();
  if (!submissionHistory[action]) {
    submissionHistory[action] = [];
  }

  // Remove timestamps outside the window
  submissionHistory[action] = submissionHistory[action].filter(timestamp => now - timestamp < windowMs);

  if (submissionHistory[action].length >= limit) {
    return false;
  }

  submissionHistory[action].push(now);
  return true;
};
