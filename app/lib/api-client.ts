import { getApiBaseUrl } from './api-base';

export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface ApiError {
  status: number;
  message: string;
  detail?: string | ValidationError[];
  errors?: ValidationError[];
}

class ApiClient {
  private getHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private formatErrors(detail: any): string {
    // Handle array of validation errors
    if (Array.isArray(detail)) {
      const messages = detail.map((err: ValidationError) => {
        const field = err.loc?.[err.loc.length - 1] || 'field';
        return `${field}: ${err.msg}`;
      });
      return messages.join('; ');
    }
    // Handle string detail
    if (typeof detail === 'string') {
      return detail;
    }
    return 'An error occurred';
  }

  private async safeFetch(path: string, init?: RequestInit): Promise<Response> {
    const base = getApiBaseUrl();
    const url = `${base}${path}`;
    try {
      return await fetch(url, init);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'Failed to fetch' || msg === 'Load failed' || msg === 'NetworkError when attempting to fetch resource.') {
        const origin =
          typeof window !== 'undefined' ? window.location.origin : '(server)';
        throw new Error(
          [
            `Cannot reach API at ${base} (page origin: ${origin}).`,
            'Checklist:',
            '1) Start the API from the backend folder with the project venv, e.g. python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000',
            '2) If you open the app via Next “Network” (LAN IP) or another device, the dev client now tries the same host as this page with port 8000; you still need --host 0.0.0.0 on uvicorn.',
            '3) In the browser, open the API base + /health — you should see {"status":"ok",...}.',
          ].join(' ')
        );
      }
      throw e;
    }
  }

  private async handleResponse(response: Response) {
    if (!response.ok) {
      const error: ApiError = {
        status: response.status,
        message: response.statusText,
      };

      try {
        const data = await response.json();
        // Store the raw detail for access
        error.detail = data.detail;
        // Format a user-friendly error message
        if (data.detail) {
          error.message = this.formatErrors(data.detail);
        }
      } catch {
        error.message = 'Failed to parse error response';
      }

      throw error;
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }

  async get(endpoint: string, token?: string) {
    const response = await this.safeFetch(endpoint, {
      method: 'GET',
      headers: this.getHeaders(token),
    });
    return this.handleResponse(response);
  }

  async post(endpoint: string, body?: any, token?: string) {
    const response = await this.safeFetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse(response);
  }

  async put(endpoint: string, body?: any, token?: string) {
    const response = await this.safeFetch(endpoint, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse(response);
  }

  async patch(endpoint: string, body?: any, token?: string) {
    const response = await this.safeFetch(endpoint, {
      method: 'PATCH',
      headers: this.getHeaders(token),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse(response);
  }

  async delete(endpoint: string, token?: string) {
    const response = await this.safeFetch(endpoint, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    return this.handleResponse(response);
  }
}

export const apiClient = new ApiClient();
