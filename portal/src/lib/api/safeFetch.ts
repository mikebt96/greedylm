export type SafeFetchResult<T> = {
  data: T | null;
  error: string | null;
  status?: number;
};

/**
 * Wrapper de fetch que previene crashes de la UI por errores de red (ej. backend caído o CORS).
 * Automáticamente antepone NEXT_PUBLIC_API_URL si la ruta es relativa.
 */
export async function safeFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<SafeFetchResult<T>> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  let url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  
  // Force HTTPS in production to avoid Mixed Content errors
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http:')) {
    url = url.replace('http:', 'https:');
  }

  const maxRetries = 3;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Handle Rate Limiting (429) with exponential backoff
    if (response.status === 429 && retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1500 + Math.random() * 1000;
      console.warn(`[safeFetch] Rate limited (429). Retrying in ${Math.round(delay)}ms... (Attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, delay));
      return safeFetch(endpoint, options, retryCount + 1);
    }

    // Manejo de errores HTTP (404, 500, etc.)
    if (!response.ok) {
      console.warn(`[safeFetch] HTTP Error ${response.status} en ${url}`);
      let errorMessage = `Error del servidor: ${response.statusText || response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch {
        // No hay JSON con detalle, usar el default
      }
      return {
        data: null,
        error: errorMessage,
        status: response.status,
      };
    }

    const data = (await response.json()) as T;
    return { data, error: null, status: response.status };

  } catch (error) {
    // Retry on network errors too
    if (retryCount < maxRetries) {
       const delay = Math.pow(2, retryCount) * 1000;
       await new Promise(r => setTimeout(r, delay));
       return safeFetch(endpoint, options, retryCount + 1);
    }
    console.error(`[safeFetch] Error de red al contactar ${url}:`, error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Error de conexión con el servidor.',
    };
  }
}
