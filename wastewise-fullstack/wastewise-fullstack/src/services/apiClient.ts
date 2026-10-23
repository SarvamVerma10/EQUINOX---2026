import type {
  AnalysisResponse,
  HistoryListResponse,
  GuideResponse,
  HealthResponse,
  ApiErrorResponse
} from '../types/api';

const SESSION_STORAGE_KEY = 'wastewise_session_id';

export class WasteWiseApiError extends Error {
  code: string;
  status: number;
  requestId?: string;

  constructor(message: string, code = 'API_ERROR', status = 500, requestId?: string) {
    super(message);
    this.name = 'WasteWiseApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

/**
 * Generate a cryptographically random UUID v4 string in the browser
 */
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Client-side session manager ensuring persistent session ID
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    return 'ssr-session-placeholder';
  }
  try {
    let sid = window.localStorage.getItem(SESSION_STORAGE_KEY);
    // Sanitize to match backend requirement: ^[a-zA-Z0-9_-]{1,128}$
    if (!sid || !/^[a-zA-Z0-9_-]{1,128}$/.test(sid)) {
      sid = `ww_session_${generateUuid().replace(/-/g, '')}`;
      window.localStorage.setItem(SESSION_STORAGE_KEY, sid);
    }
    return sid;
  } catch (e) {
    return `ww_session_${Date.now()}`;
  }
}

export function resetSessionId(): string {
  if (typeof window !== 'undefined') {
    const newSid = `ww_session_${generateUuid().replace(/-/g, '')}`;
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, newSid);
    } catch {}
    return newSid;
  }
  return 'ssr-session-placeholder';
}

export class WasteWiseApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    const configuredUrl =
      baseUrl ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) ||
      'http://localhost:8080/api/v1';

    // Remove trailing slash if present
    this.baseUrl = configuredUrl.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const sessionId = getOrCreateSessionId();
    const requestId = generateUuid();

    const headers: Record<string, string> = {
      'x-session-id': sessionId,
      'x-request-id': requestId,
      ...((options.headers as Record<string, string>) || {})
    };

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers
      });
    } catch (networkError: any) {
      throw new WasteWiseApiError(
        networkError?.message || `Cannot connect to WasteWise backend at ${this.baseUrl}. Check that the backend server is running.`,
        'NETWORK_ERROR',
        0,
        requestId
      );
    }

    // Try parsing JSON response
    let responseBody: any;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        responseBody = await response.json();
      } catch (parseErr) {
        throw new WasteWiseApiError(
          'Failed to parse JSON response from backend server.',
          'INVALID_JSON',
          response.status,
          requestId
        );
      }
    } else {
      const text = await response.text();
      if (!response.ok) {
        throw new WasteWiseApiError(
          text || `HTTP error ${response.status}: ${response.statusText}`,
          'HTTP_ERROR',
          response.status,
          requestId
        );
      }
      return text as unknown as T;
    }

    if (!response.ok) {
      // Backend error response schema: { error: { code, message, requestId } }
      const errorObj = (responseBody as ApiErrorResponse)?.error;
      const errorCode = errorObj?.code || `HTTP_${response.status}`;
      const errorMessage = errorObj?.message || `Request failed with HTTP status ${response.status}`;
      const errRequestId = errorObj?.requestId || requestId;

      throw new WasteWiseApiError(errorMessage, errorCode, response.status, errRequestId);
    }

    return responseBody as T;
  }

  /**
   * Health Check: GET /api/v1/health
   */
  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health', { method: 'GET' });
  }

  /**
   * Active Guide: GET /api/v1/guides/active
   */
  async getActiveGuide(localityId = 'metro-central'): Promise<GuideResponse> {
    return this.request<GuideResponse>(`/guides/active?localityId=${encodeURIComponent(localityId)}`, {
      method: 'GET'
    });
  }

  /**
   * Analyze Image File: POST /api/v1/analyze (multipart/form-data)
   */
  async analyzeImage(
    file: File | Blob,
    options?: { localityId?: string; productNameHint?: string; filename?: string }
  ): Promise<AnalysisResponse> {
    const formData = new FormData();
    const filename = options?.filename || (file instanceof File ? file.name : 'captured_waste.jpg');
    formData.append('file', file, filename);
    formData.append('localityId', options?.localityId || 'metro-central');
    if (options?.productNameHint) {
      formData.append('productNameHint', options.productNameHint);
    }

    return this.request<AnalysisResponse>('/analyze', {
      method: 'POST',
      body: formData
    });
  }

  /**
   * Analyze Text Query: POST /api/v1/analyze (application/json)
   */
  async analyzeText(
    textDescription: string,
    options?: { localityId?: string; productNameHint?: string }
  ): Promise<AnalysisResponse> {
    return this.request<AnalysisResponse>('/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        textDescription,
        localityId: options?.localityId || 'metro-central',
        productNameHint: options?.productNameHint
      })
    });
  }

  /**
   * Clarify Analysis: POST /api/v1/analyze/:analysisId/clarify
   */
  async clarifyAnalysis(
    analysisId: string,
    answers: Array<{ question: string; answer: string }>
  ): Promise<AnalysisResponse> {
    return this.request<AnalysisResponse>(`/analyze/${encodeURIComponent(analysisId)}/clarify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ answers })
    });
  }

  /**
   * Correction: POST /api/v1/analyze/:analysisId/correction
   */
  async submitCorrection(
    analysisId: string,
    correction: {
      correctedItemName?: string;
      correctedComponents?: Array<{ name: string; material: string }>;
    }
  ): Promise<AnalysisResponse> {
    return this.request<AnalysisResponse>(`/analyze/${encodeURIComponent(analysisId)}/correction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(correction)
    });
  }

  /**
   * User History: GET /api/v1/history
   */
  async getHistory(): Promise<HistoryListResponse> {
    return this.request<HistoryListResponse>('/history', { method: 'GET' });
  }
}

// Export singleton instance
export const apiClient = new WasteWiseApiClient();
