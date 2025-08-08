/**
 * Utility functions for making authenticated API requests
 */

/**
 * Get authentication headers for API requests
 */
export function getAuthHeaders(fid?: number): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (fid) {
    headers['x-farcaster-fid'] = fid.toString();
  }

  return headers;
}

/**
 * Make an authenticated GET request
 */
export async function authenticatedGet(url: string, fid?: number) {
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(fid),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Make an authenticated POST request
 */
export async function authenticatedPost(url: string, data: any, fid?: number) {
  console.log(`[API] POST request to ${url} with fid: ${fid}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(fid),
    body: JSON.stringify(data),
  });

  console.log(`[API] Response status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
    
    try {
      const errorBody = await response.text();
      console.error(`[API] Error response body:`, errorBody);
      
      // Try to parse as JSON to get more detailed error information
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.error) {
          errorMessage = errorJson.error;
        }
      } catch {
        // If not JSON, use the raw text
        if (errorBody) {
          errorMessage = errorBody;
        }
      }
    } catch (e) {
      console.error(`[API] Failed to read error response:`, e);
    }
    
    throw new Error(errorMessage);
  }

  const result = await response.json();
  console.log(`[API] Success response:`, result);
  return result;
}

/**
 * Make an authenticated PATCH request
 */
export async function authenticatedPatch(url: string, data: any, fid?: number) {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: getAuthHeaders(fid),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Make an authenticated PUT request
 */
export async function authenticatedPut(url: string, data: any, fid?: number) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: getAuthHeaders(fid),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}