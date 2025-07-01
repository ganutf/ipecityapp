// All JustaName subdomain creation functionality has been moved to client-side
// Server-side JustaName API code removed as subdomain creation is now handled
// entirely through the @justaname.id/react hook in the frontend components

export function sanitizeUsername(username: string): string {
  // Convert to lowercase and remove invalid characters for ENS
  return username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Keep only letters and numbers
    .slice(0, 20); // Ensure max length
}