declare module 'fs-js-lite' {
  interface FamilySearchOptions {
    clientId?: string;
    redirectUri?: string;
    accessToken?: string;
    refreshToken?: string;
    environment?: 'production' | 'beta' | 'integration';
    saveAccessToken?: (accessToken: string) => void;
    maxThrottledRetries?: number;
  }

  interface FSError {
    message: string;
    statusCode?: number;
    status?: number;
    body?: any;
  }

  interface FSResponse {
    statusCode: number;
    headers: Record<string, string>;
    data?: any;
    body?: string;
    requestData?: any;
    requestUrl?: string;
    redirected?: boolean;
    originalUrl?: string;
    throttled?: boolean;
    retries?: number;
  }

  type FSCallback = (error: FSError | null, response?: FSResponse) => void;

  export default class FamilySearch {
    constructor(options?: FamilySearchOptions);
    setClientId(clientId: string): void;
    setRedirectUri(redirectUri: string): void;
    getAccessToken(): string | undefined;
    getRefreshToken(): string | undefined;
    setAccessToken(accessToken: string): void;
    setRefreshToken(refreshToken: string): void;
    oauthPassword(username: string, password: string, callback: FSCallback): void;
    oauthRefreshToken(callback: FSCallback): void;
    get(url: string, params?: Record<string, any> | FSCallback, callback?: FSCallback): void;
    post(url: string, data?: any, callback?: FSCallback): void;
    put(url: string, data?: any, callback?: FSCallback): void;
    delete(url: string, callback?: FSCallback): void;
    head(url: string, callback?: FSCallback): void;
  }
}

// Extend the McpServer type to include the getTool method
declare module '@modelcontextprotocol/sdk/server/mcp.js' {
  interface McpServer {
    getTool(name: string): {
      handler: (params: any) => Promise<any>;
    };
  }
} 