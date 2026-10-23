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

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
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
   * Direct calls to Next.js Vision & Universal Stream API (/api/identify)
   */
  async identifyWaste(payload: {
    imageBase64?: string;
    image?: string;
    mimeType?: string;
    textDescription?: string;
    productNameHint?: string;
  }): Promise<any> {
    const res = await fetch('/api/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new WasteWiseApiError(
        errData.reason || `Identify failed with status ${res.status}`,
        'IDENTIFY_ERROR',
        res.status
      );
    }
    return res.json();
  }

  /**
   * Direct calls to Next.js Deterministic Municipal Guide Evaluator (/api/disposal)
   */
  async evaluateDisposal(payload: {
    identification: any;
    selectedComponent?: string | null;
    customGuide?: any;
  }): Promise<any> {
    const res = await fetch('/api/disposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new WasteWiseApiError(
        errData.reason || `Disposal evaluation failed with status ${res.status}`,
        'DISPOSAL_ERROR',
        res.status
      );
    }
    return res.json();
  }

  /**
   * Analyze Image: Handles File, Blob, or base64 Data URL, sending exact JSON to /api/identify
   * and evaluating against local guide rules (/api/disposal).
   */
  async analyzeImage(
    file: File | Blob | string,
    options?: { localityId?: string; productNameHint?: string; filename?: string }
  ): Promise<AnalysisResponse> {
    let dataUrl: string;
    let mimeType = 'image/jpeg';

    if (typeof file === 'string') {
      dataUrl = file;
      if (dataUrl.startsWith('data:')) {
        const match = dataUrl.match(/^data:([^;]+);/);
        if (match) mimeType = match[1];
      }
    } else {
      mimeType = file.type || 'image/jpeg';
      dataUrl = await fileToDataUrl(file);
    }

    // Call Next.js /api/identify route
    const identifyRes = await this.identifyWaste({
      imageBase64: dataUrl,
      mimeType,
      productNameHint: options?.productNameHint
    });

    const identifiedItem = identifyRes.item;

    // Check if clarification is required
    if (identifyRes.status === 'clarification_needed' || identifyRes.clarificationQuestion) {
      return {
        analysisId: `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        status: 'clarification_required',
        item: {
          name: identifiedItem?.name || 'Uncertain Item',
          alternatives: [],
          components: identifiedItem?.components || [],
          material: identifiedItem?.material,
          confidence: identifiedItem?.confidence,
          universalStream: identifiedItem?.universalStream
        },
        clarification: {
          required: true,
          questions: identifyRes.clarificationQuestion ? [identifyRes.clarificationQuestion] : []
        },
        recommendation: null,
        evidence: []
      };
    }

    // Evaluate disposal with municipal guide
    const disposalRes = await this.evaluateDisposal({
      identification: identifiedItem,
      selectedComponent: null
    });

    return {
      analysisId: `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: disposalRes.status === 'recommended' ? 'recommendation_ready' : 'no_supported_rule',
      item: {
        name: disposalRes.item?.name || identifiedItem?.name || 'Scanned Waste Item',
        alternatives: [],
        components: disposalRes.item?.components || identifiedItem?.components || [],
        material: disposalRes.item?.material || identifiedItem?.material,
        confidence: disposalRes.item?.confidence || identifiedItem?.confidence,
        universalStream: disposalRes.universalStream || identifiedItem?.universalStream
      } as any,
      clarification: {
        required: disposalRes.status === 'clarification_needed',
        questions: disposalRes.clarificationQuestion ? [disposalRes.clarificationQuestion] : []
      },
      recommendation: {
        category: disposalRes.physicalBinNote || disposalRes.category,
        instructions: disposalRes.instructions || [],
        explanation: disposalRes.reason || `Verified municipal waste stream classification.`,
        universalStream: disposalRes.universalStream || identifiedItem?.universalStream
      } as any,
      evidence: disposalRes.evidence ? [{
        ruleId: disposalRes.evidence.section || 'municipal-rule',
        sourceExcerpt: disposalRes.evidence.excerpt || 'Official Municipal Waste Sorting Guideline.',
        pageNumber: disposalRes.evidence.page || null,
        sectionTitle: disposalRes.evidence.section || null
      }] : []
    };
  }

  /**
   * Analyze Text Query: Evaluates text description against universal streams and municipal guide
   */
  async analyzeText(
    textDescription: string,
    options?: { localityId?: string; productNameHint?: string }
  ): Promise<AnalysisResponse> {
    const identifyRes = await this.identifyWaste({
      textDescription,
      productNameHint: options?.productNameHint
    });

    const identifiedItem = identifyRes.item;

    if (identifyRes.status === 'clarification_needed' || identifyRes.clarificationQuestion) {
      return {
        analysisId: `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        status: 'clarification_required',
        item: {
          name: identifiedItem?.name || textDescription,
          alternatives: [],
          components: identifiedItem?.components || [],
          material: identifiedItem?.material,
          confidence: identifiedItem?.confidence,
          universalStream: identifiedItem?.universalStream
        } as any,
        clarification: {
          required: true,
          questions: identifyRes.clarificationQuestion ? [identifyRes.clarificationQuestion] : []
        },
        recommendation: null,
        evidence: []
      };
    }

    const disposalRes = await this.evaluateDisposal({
      identification: identifiedItem,
      selectedComponent: null
    });

    return {
      analysisId: `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: disposalRes.status === 'recommended' ? 'recommendation_ready' : 'no_supported_rule',
      item: {
        name: disposalRes.item?.name || identifiedItem?.name || textDescription,
        alternatives: [],
        components: disposalRes.item?.components || identifiedItem?.components || [],
        material: disposalRes.item?.material || identifiedItem?.material,
        confidence: disposalRes.item?.confidence || identifiedItem?.confidence,
        universalStream: disposalRes.universalStream || identifiedItem?.universalStream
      } as any,
      clarification: {
        required: disposalRes.status === 'clarification_needed',
        questions: disposalRes.clarificationQuestion ? [disposalRes.clarificationQuestion] : []
      },
      recommendation: {
        category: disposalRes.physicalBinNote || disposalRes.category,
        instructions: disposalRes.instructions || [],
        explanation: disposalRes.reason || `Verified municipal waste stream classification.`,
        universalStream: disposalRes.universalStream || identifiedItem?.universalStream
      } as any,
      evidence: disposalRes.evidence ? [{
        ruleId: disposalRes.evidence.section || 'municipal-rule',
        sourceExcerpt: disposalRes.evidence.excerpt || 'Official Municipal Waste Sorting Guideline.',
        pageNumber: disposalRes.evidence.page || null,
        sectionTitle: disposalRes.evidence.section || null
      }] : []
    };
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
