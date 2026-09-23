/**
 * Wrapper de acesso à API do ChokoCRM.
 *
 * - `baseUrl` vem de `VITE_API_URL` (padrão `http://localhost:3000`).
 * - Injeta automaticamente o token Bearer salvo em `localStorage` (ver
 *   `setToken`/`clearToken`, usados pelo `AuthContext`).
 * - Erros retornados pela API no formato `{ error: { code, message, details? } }`
 *   viram uma exceção `ApiError` com `code`/`message`/`details`.
 * - Quando uma chamada QUE JÁ ENVIOU um Bearer token recebe 401 de volta
 *   (token expirado/inválido), dispara o callback registrado via
 *   `setUnauthorizedHandler` — o `AuthProvider` usa isso para limpar a
 *   sessão e redirecionar para `/login`. Um 401 de `/auth/login` (sem
 *   token, credenciais erradas) não passa por essa checagem: quem chama
 *   trata o erro localmente (ver `LoginPage`).
 */

const DEFAULT_BASE_URL = 'http://localhost:3000';

const baseUrl = (import.meta.env.VITE_API_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');

const TOKEN_KEY = 'chokocrm:token';

export class ApiError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Registra o callback disparado quando uma chamada autenticada (com Bearer
 * token) recebe 401 da API — ver nota no topo do arquivo. Passe `null` para
 * remover o callback (ex.: no cleanup de um `useEffect`).
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let requestBody: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { method, headers, body: requestBody });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Não foi possível conectar ao servidor.');
  }

  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const errorInfo = (data as ApiErrorBody | undefined)?.error;

    // Token que acompanhava a chamada foi rejeitado (expirado/inválido):
    // encerra a sessão local e deixa o AuthProvider redirecionar para
    // /login. Um 401 sem token (ex.: /auth/login com senha errada) não
    // aciona isso — é responsabilidade de quem chamou tratar o erro.
    if (response.status === 401 && token) {
      unauthorizedHandler?.();
    }

    throw new ApiError(
      errorInfo?.code ?? 'UNKNOWN_ERROR',
      errorInfo?.message ?? 'Erro inesperado. Tente novamente.',
      errorInfo?.details,
    );
  }

  return data as T;
}

/**
 * Variante de `request` para corpos e respostas que não são JSON (fotos de
 * check-in). Mantém o mesmo tratamento de token, de erro de rede e de 401
 * expirado, mas devolve a `Response` crua para quem chamou decidir se lê
 * como `Blob` ou ignora o corpo.
 */
async function requestNaoJson(
  method: string,
  path: string,
  opcoes: { body?: BodyInit; contentType?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (opcoes.contentType) {
    headers['Content-Type'] = opcoes.contentType;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { method, headers, body: opcoes.body });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Não foi possível conectar ao servidor.');
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      unauthorizedHandler?.();
    }

    let code = 'UNKNOWN_ERROR';
    let message = 'Erro inesperado. Tente novamente.';
    try {
      const corpo = (await response.json()) as ApiErrorBody;
      code = corpo.error?.code ?? code;
      message = corpo.error?.message ?? message;
    } catch {
      // Resposta de erro sem JSON: mantém a mensagem genérica.
    }

    throw new ApiError(code, message);
  }

  return response;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>('GET', path),
  post: <T>(path: string, body?: unknown): Promise<T> => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown): Promise<T> => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown): Promise<T> => request<T>('PATCH', path, body),
  del: <T>(path: string): Promise<T> => request<T>('DELETE', path),
  putBinario: async (path: string, conteudo: Blob): Promise<void> => {
    await requestNaoJson('PUT', path, { body: conteudo, contentType: conteudo.type || 'image/jpeg' });
  },
  getBlob: async (path: string): Promise<Blob> => (await requestNaoJson('GET', path)).blob(),
};
