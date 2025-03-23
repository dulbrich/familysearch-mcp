declare module '@modelcontextprotocol/sdk/server/mcp.js' {
  export class McpServer {
    constructor(options: { name: string; version: string });
    
    tool<T extends Record<string, any>>(
      name: string,
      description: string,
      parameters: Record<string, any>,
      handler: (params: T) => Promise<any>
    ): void;
    
    connect(transport: any): Promise<void>;
    
    getTool(name: string): {
      handler: (params: any) => Promise<any>;
    };
  }
}

declare module '@modelcontextprotocol/sdk/server/stdio.js' {
  export class StdioServerTransport {
    constructor();
  }
} 