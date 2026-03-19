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
  options: RequestInit = {}
): Promise<SafeFetchResult<T>> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

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
    // Manejo de errores de red pura (Backend apagado, CORS bloqueado, sin internet)
    console.error(`[safeFetch] Error de red al contactar ${url}:`, error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Error de conexión con el servidor.',
    };
  }
}
