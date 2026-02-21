/**
 * Utility functions for making authenticated API requests.
 *
 * Supports both Privy Bearer token auth (primary) and legacy Farcaster FID auth.
 * The AuthContext sets the Privy token via setApiAccessToken() when authenticated.
 */

let _accessToken: string | null = null;

/** Called by AuthContext to keep the token in sync */
export function setApiAccessToken(token: string | null) {
  _accessToken = token;
}

/**
 * Get authentication headers for API requests
 */
export function getAuthHeaders(fid?: number): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Privy Bearer token (primary auth)
  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  // Legacy Farcaster FID header (fallback)
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
  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(fid),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status} ${response.statusText}`;

    try {
      const errorBody = await response.text();
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.error) {
          errorMessage = errorJson.error;
        }
      } catch {
        if (errorBody) {
          errorMessage = errorBody;
        }
      }
    } catch {
      // Failed to read error response
    }

    throw new Error(errorMessage);
  }

  return response.json();
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

/**
 * Make an authenticated DELETE request
 */
export async function authenticatedDelete(url: string, fid?: number) {
  const response = await fetch(url, {
    method: 'DELETE',
    headers: getAuthHeaders(fid),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
