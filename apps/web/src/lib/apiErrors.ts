import { AxiosError } from 'axios';

/** Mensaje claro para mostrar cuando falla una llamada a la API. */
export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const responseBody = error.response?.data as { message?: string | string[] } | undefined;

    if (Array.isArray(responseBody?.message) && responseBody.message.length > 0) {
      return responseBody.message[0];
    }

    if (typeof responseBody?.message === 'string') {
      return responseBody.message;
    }

    if (error.response?.status === 401) {
      return 'Tu sesión expiró. Inicia sesión nuevamente.';
    }

    if (!error.response) {
      return 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.';
    }

    return 'No pudimos completar la acción. Intenta de nuevo.';
  }

  return 'Ocurrió un error inesperado.';
}
