import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as fs from 'fs';
import FamilySearch from 'fs-js-lite';
import * as os from 'os';
import * as path from 'path';
import { z } from "zod";

// Create server instance
const server = new McpServer({
  name: "familysearch",
  version: "1.0.0",
});

// Config paths
const configDir = path.join(os.homedir(), '.familysearch-mcp');
const configPath = path.join(configDir, 'config.json');

// Ensure config directory exists
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Default config
let config = {
  clientId: '',
  redirectUri: 'https://localhost:8080/oauth-redirect',
  accessToken: '',
  refreshToken: '',
  username: '',
  password: ''
};

// Load config if exists
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

// Save config
const saveConfig = () => {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
};

// Initialize FamilySearch SDK
const client = new FamilySearch({
  clientId: config.clientId,
  redirectUri: config.redirectUri,
  accessToken: config.accessToken,
  refreshToken: config.refreshToken,
  environment: 'production'
});

// Basic Hello Tool
server.tool(
  "say-hello",
  "Say hello to the user",
  {
    name: z.string().describe("The name of the user to say hello to"),
  },
  async ({ name }: { name: string }) => {
    return {
      content: [
        {
          type: "text",
          text: `Hello ${name}. You are looking awesome today!`
        }
      ]
    }
  }
);

// Configure FamilySearch API credentials
server.tool(
  "configure",
  "Configure FamilySearch API credentials",
  {
    clientId: z.string().describe("Your FamilySearch API client ID"),
    redirectUri: z.string().optional().describe("OAuth redirect URI (default: https://localhost:8080/oauth-redirect)"),
  },
  async ({ clientId, redirectUri }: { clientId: string, redirectUri?: string }) => {
    config.clientId = clientId;
    if (redirectUri) {
      config.redirectUri = redirectUri;
    }
    
    // Update client
    client.setClientId(clientId);
    client.setRedirectUri(config.redirectUri);
    
    saveConfig();
    
    return {
      content: [
        {
          type: "text",
          text: `FamilySearch API credentials configured. Client ID: ${clientId}`
        }
      ]
    }
  }
);

// Authenticate with username/password
server.tool(
  "authenticate",
  "Authenticate with FamilySearch",
  {
    username: z.string().describe("Your FamilySearch username"),
    password: z.string().describe("Your FamilySearch password"),
  },
  async ({ username, password }: { username: string, password: string }) => {
    if (!config.clientId) {
      return {
        content: [
          {
            type: "text",
            text: "Please configure your FamilySearch API credentials first using the 'configure' tool."
          }
        ]
      }
    }
    
    try {
      const response = await new Promise<any>((resolve, reject) => {
        client.oauthPassword(username, password, (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        });
      });
      
      // Save credentials
      config.username = username;
      config.password = password;
      const accessToken = client.getAccessToken();
      const refreshToken = client.getRefreshToken();
      
      if (accessToken) config.accessToken = accessToken;
      if (refreshToken) config.refreshToken = refreshToken;
      
      saveConfig();
      
      return {
        content: [
          {
            type: "text",
            text: "Successfully authenticated with FamilySearch!"
          }
        ]
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Authentication failed: ${error.message || JSON.stringify(error)}`
          }
        ]
      }
    }
  }
);

// Get current user info
server.tool(
  "get-current-user",
  "Get information about the currently authenticated user",
  {},
  async () => {
    if (!client.getAccessToken()) {
      return {
        content: [
          {
            type: "text",
            text: "Not authenticated. Please authenticate first using the 'authenticate' tool."
          }
        ]
      }
    }
    
    try {
      const response = await new Promise<any>((resolve, reject) => {
        client.get('/platform/users/current', (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        });
      });
      
      const user = response.data?.users?.[0] || {};
      
      return {
        content: [
          {
            type: "text",
            text: `Current user: ${user.displayName || user.contactName || 'Unknown'}\nID: ${user.id || 'Unknown'}`
          }
        ]
      }
    } catch (error: any) {
      // Try to refresh token if expired
      if (error.statusCode === 401 && config.refreshToken) {
        try {
          await new Promise<any>((resolve, reject) => {
            client.oauthRefreshToken((error: any, response: any) => {
              if (error) {
                reject(error);
              } else {
                resolve(response);
              }
            });
          });
          
          // Update saved tokens
          const accessToken = client.getAccessToken();
          const refreshToken = client.getRefreshToken();
          
          if (accessToken) config.accessToken = accessToken;
          if (refreshToken) config.refreshToken = refreshToken;
          
          saveConfig();
          
          // Retry the request - use the same handler function
          const currentUserTool = server as any;
          return await currentUserTool.getTool("get-current-user").handler({});
        } catch (refreshError: any) {
          return {
            content: [
              {
                type: "text",
                text: `Session expired and refresh failed: ${refreshError.message || JSON.stringify(refreshError)}`
              }
            ]
          }
        }
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Error fetching user info: ${error.message || JSON.stringify(error)}`
          }
        ]
      }
    }
  }
);

// Search for person records
server.tool(
  "search-persons",
  "Search for person records in FamilySearch",
  {
    name: z.string().optional().describe("Name to search for"),
    birthDate: z.string().optional().describe("Birth date (YYYY-MM-DD)"),
    birthPlace: z.string().optional().describe("Birth place"),
    deathDate: z.string().optional().describe("Death date (YYYY-MM-DD)"),
    deathPlace: z.string().optional().describe("Death place"),
    gender: z.enum(["MALE", "FEMALE"]).optional().describe("Gender"),
    limit: z.number().optional().describe("Maximum number of results (default: 10)"),
  },
  async (params: {
    name?: string;
    birthDate?: string;
    birthPlace?: string;
    deathDate?: string;
    deathPlace?: string;
    gender?: "MALE" | "FEMALE";
    limit?: number;
  }) => {
    if (!client.getAccessToken()) {
      return {
        content: [
          {
            type: "text",
            text: "Not authenticated. Please authenticate first using the 'authenticate' tool."
          }
        ]
      }
    }
    
    const searchParams: Record<string, any> = {};
    if (params.name) searchParams.name = params.name;
    if (params.birthDate) searchParams.birthDate = params.birthDate;
    if (params.birthPlace) searchParams.birthPlace = params.birthPlace;
    if (params.deathDate) searchParams.deathDate = params.deathDate;
    if (params.deathPlace) searchParams.deathPlace = params.deathPlace;
    if (params.gender) searchParams.gender = params.gender;
    
    const limit = params.limit || 10;
    
    try {
      const response = await new Promise<any>((resolve, reject) => {
        client.get('/platform/tree/search', {
          q: searchParams,
          count: limit
        }, (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        });
      });
      
      const persons = response.data?.entries || [];
      
      if (persons.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No persons found matching your search criteria."
            }
          ]
        }
      }
      
      const formattedResults = persons.map((person: any) => {
        const birthEvent = person.content?.gedcomx?.persons?.[0]?.facts?.find((fact: any) => fact.type === 'http://gedcomx.org/Birth');
        const deathEvent = person.content?.gedcomx?.persons?.[0]?.facts?.find((fact: any) => fact.type === 'http://gedcomx.org/Death');
        
        return {
          id: person.id,
          name: person.title || 'Unknown',
          gender: person.content?.gedcomx?.persons?.[0]?.gender?.type?.replace('http://gedcomx.org/', '') || 'Unknown',
          birth: birthEvent ? `${birthEvent.date?.original || 'Unknown date'} - ${birthEvent.place?.original || 'Unknown place'}` : 'Unknown',
          death: deathEvent ? `${deathEvent.date?.original || 'Unknown date'} - ${deathEvent.place?.original || 'Unknown place'}` : 'Unknown',
        };
      });
      
      const resultsText = formattedResults.map((person: any, index: number) => 
        `${index + 1}. ${person.name} (${person.id})\n   Gender: ${person.gender}\n   Birth: ${person.birth}\n   Death: ${person.death}`
      ).join('\n\n');
      
      return {
        content: [
          {
            type: "text",
            text: `Found ${persons.length} matching records:\n\n${resultsText}`
          }
        ]
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching persons: ${error.message || JSON.stringify(error)}`
          }
        ]
      }
    }
  }
);

// Get person details
server.tool(
  "get-person",
  "Get detailed information about a specific person",
  {
    personId: z.string().describe("Person ID"),
  },
  async ({ personId }: { personId: string }) => {
    if (!client.getAccessToken()) {
      return {
        content: [
          {
            type: "text",
            text: "Not authenticated. Please authenticate first using the 'authenticate' tool."
          }
        ]
      }
    }
    
    try {
      const response = await new Promise<any>((resolve, reject) => {
        client.get(`/platform/tree/persons/${personId}`, (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        });
      });
      
      const person = response.data?.persons?.[0];
      
      if (!person) {
        return {
          content: [
            {
              type: "text",
              text: `No person found with ID: ${personId}`
            }
          ]
        }
      }
      
      const names = person.names?.map((name: any) => name.nameForms?.[0]?.fullText).filter(Boolean) || ['Unknown'];
      const gender = person.gender?.type?.replace('http://gedcomx.org/', '') || 'Unknown';
      
      const facts = person.facts?.map((fact: any) => {
        const type = fact.type.replace('http://gedcomx.org/', '');
        const date = fact.date?.original || 'Unknown date';
        const place = fact.place?.original || 'Unknown place';
        return `${type}: ${date} - ${place}`;
      }).join('\n   ') || 'No facts available';
      
      return {
        content: [
          {
            type: "text",
            text: `Person Details:\nID: ${personId}\nName: ${names[0]}\nGender: ${gender}\n\nFacts:\n   ${facts}`
          }
        ]
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching person details: ${error.message || JSON.stringify(error)}`
          }
        ]
      }
    }
  }
);

// Get person's ancestors
server.tool(
  "get-ancestors",
  "Get ancestors of a specific person",
  {
    personId: z.string().describe("Person ID"),
    generations: z.number().optional().describe("Number of generations (default: 4, max: 8)"),
  },
  async ({ personId, generations = 4 }: { personId: string, generations?: number }) => {
    if (!client.getAccessToken()) {
      return {
        content: [
          {
            type: "text",
            text: "Not authenticated. Please authenticate first using the 'authenticate' tool."
          }
        ]
      }
    }
    
    // Cap generations at 8
    const gens = Math.min(generations || 4, 8);
    
    try {
      const response = await new Promise<any>((resolve, reject) => {
        client.get(`/platform/tree/ancestry`, {
          person: personId,
          generations: gens
        }, (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        });
      });
      
      const persons = response.data?.persons || [];
      const relationships = response.data?.relationships || [];
      
      if (persons.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No ancestors found for person with ID: ${personId}`
            }
          ]
        }
      }
      
      // Build relationship map
      const childToParents: Record<string, string[]> = {};
      relationships.forEach((rel: any) => {
        if (rel.type === 'http://gedcomx.org/ParentChild') {
          const childId = rel.person2?.resourceId;
          const parentId = rel.person1?.resourceId;
          
          if (childId && parentId) {
            if (!childToParents[childId]) {
              childToParents[childId] = [];
            }
            childToParents[childId].push(parentId);
          }
        }
      });
      
      // Person map for quick lookup
      const personsMap: Record<string, any> = {};
      persons.forEach((person: any) => {
        personsMap[person.id] = person;
      });
      
      // Format ancestral lines
      const formatPerson = (p: any) => {
        const name = p.names?.[0]?.nameForms?.[0]?.fullText || 'Unknown';
        const birthFact = p.facts?.find((f: any) => f.type === 'http://gedcomx.org/Birth');
        const birthYear = birthFact?.date?.original ? `(${birthFact.date.original.match(/\d{4}/)?.[0] || '?'})` : '';
        return `${name} ${birthYear} [${p.id}]`;
      };
      
      // Find the root person
      const rootPerson = persons.find((p: any) => p.id === personId);
      if (!rootPerson) {
        return {
          content: [
            {
              type: "text",
              text: `Could not find the requested person in the response.`
            }
          ]
        }
      }
      
      // Build ancestral lines
      let ancestorLines = [`Root: ${formatPerson(rootPerson)}`];
      
      const buildLine = (personId: string, generation = 1, prefix = '') => {
        const parents = childToParents[personId] || [];
        
        parents.forEach((parentId, index) => {
          const parent = personsMap[parentId];
          if (parent) {
            const relation = parent.gender?.type === 'http://gedcomx.org/Male' ? 'Father' : 'Mother';
            const newPrefix = prefix + '  ';
            ancestorLines.push(`${newPrefix}${relation}: ${formatPerson(parent)}`);
            
            if (generation < gens) {
              buildLine(parentId, generation + 1, newPrefix);
            }
          }
        });
      };
      
      buildLine(personId);
      
      return {
        content: [
          {
            type: "text",
            text: `Ancestors (${gens} generations):\n\n${ancestorLines.join('\n')}`
          }
        ]
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching ancestors: ${error.message || JSON.stringify(error)}`
          }
        ]
      }
    }
  }
);

// Get person's descendants
server.tool(
  "get-descendants",
  "Get descendants of a specific person",
  {
    personId: z.string().describe("Person ID"),
    generations: z.number().optional().describe("Number of generations (default: 2, max: 3)"),
  },
  async ({ personId, generations = 2 }: { personId: string, generations?: number }) => {
    if (!client.getAccessToken()) {
      return {
        content: [
          {
            type: "text",
            text: "Not authenticated. Please authenticate first using the 'authenticate' tool."
          }
        ]
      }
    }
    
    // Cap generations at 3 (API limitation)
    const gens = Math.min(generations || 2, 3);
    
    try {
      const response = await new Promise<any>((resolve, reject) => {
        client.get(`/platform/tree/descendancy`, {
          person: personId,
          generations: gens
        }, (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        });
      });
      
      const persons = response.data?.persons || [];
      const relationships = response.data?.relationships || [];
      
      if (persons.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No descendants found for person with ID: ${personId}`
            }
          ]
        }
      }
      
      // Build relationship map
      const parentToChildren: Record<string, string[]> = {};
      relationships.forEach((rel: any) => {
        if (rel.type === 'http://gedcomx.org/ParentChild') {
          const childId = rel.person2?.resourceId;
          const parentId = rel.person1?.resourceId;
          
          if (childId && parentId) {
            if (!parentToChildren[parentId]) {
              parentToChildren[parentId] = [];
            }
            parentToChildren[parentId].push(childId);
          }
        }
      });
      
      // Person map for quick lookup
      const personsMap: Record<string, any> = {};
      persons.forEach((person: any) => {
        personsMap[person.id] = person;
      });
      
      // Format person
      const formatPerson = (p: any) => {
        const name = p.names?.[0]?.nameForms?.[0]?.fullText || 'Unknown';
        const birthFact = p.facts?.find((f: any) => f.type === 'http://gedcomx.org/Birth');
        const birthYear = birthFact?.date?.original ? `(${birthFact.date.original.match(/\d{4}/)?.[0] || '?'})` : '';
        return `${name} ${birthYear} [${p.id}]`;
      };
      
      // Find the root person
      const rootPerson = persons.find((p: any) => p.id === personId);
      if (!rootPerson) {
        return {
          content: [
            {
              type: "text",
              text: `Could not find the requested person in the response.`
            }
          ]
        }
      }
      
      // Build descendant tree
      let descendantLines = [`Root: ${formatPerson(rootPerson)}`];
      
      const buildLine = (personId: string, generation = 1, prefix = '') => {
        const children = parentToChildren[personId] || [];
        
        children.forEach((childId, index) => {
          const child = personsMap[childId];
          if (child) {
            const newPrefix = prefix + '  ';
            descendantLines.push(`${newPrefix}Child: ${formatPerson(child)}`);
            
            if (generation < gens) {
              buildLine(childId, generation + 1, newPrefix);
            }
          }
        });
      };
      
      buildLine(personId);
      
      return {
        content: [
          {
            type: "text",
            text: `Descendants (${gens} generations):\n\n${descendantLines.join('\n')}`
          }
        ]
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching descendants: ${error.message || JSON.stringify(error)}`
          }
        ]
      }
    }
  }
);

// Search historical records
server.tool(
  "search-records",
  "Search for historical records in FamilySearch",
  {
    givenName: z.string().optional().describe("Given name"),
    surname: z.string().optional().describe("Surname/last name"),
    birthDate: z.string().optional().describe("Birth date (YYYY-MM-DD)"),
    birthPlace: z.string().optional().describe("Birth place"),
    deathDate: z.string().optional().describe("Death date (YYYY-MM-DD)"),
    deathPlace: z.string().optional().describe("Death place"),
    collectionId: z.string().optional().describe("Specific collection ID to search in"),
    limit: z.number().optional().describe("Maximum number of results (default: 10)"),
  },
  async (params: {
    givenName?: string;
    surname?: string;
    birthDate?: string;
    birthPlace?: string;
    deathDate?: string;
    deathPlace?: string;
    collectionId?: string;
    limit?: number;
  }) => {
    if (!client.getAccessToken()) {
      return {
        content: [
          {
            type: "text",
            text: "Not authenticated. Please authenticate first using the 'authenticate' tool."
          }
        ]
      }
    }
    
    const searchParams: Record<string, any> = {};
    if (params.givenName) searchParams.givenName = params.givenName;
    if (params.surname) searchParams.surname = params.surname;
    if (params.birthDate) searchParams.birthDate = params.birthDate;
    if (params.birthPlace) searchParams.birthPlace = params.birthPlace;
    if (params.deathDate) searchParams.deathDate = params.deathDate;
    if (params.deathPlace) searchParams.deathPlace = params.deathPlace;
    
    const limit = params.limit || 10;
    const requestParams: Record<string, any> = { q: searchParams, count: limit };
    
    if (params.collectionId) {
      requestParams.collection = params.collectionId;
    }
    
    try {
      const response = await new Promise<any>((resolve, reject) => {
        client.get('/platform/records/search', requestParams, (error: any, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        });
      });
      
      const records = response.data?.entries || [];
      
      if (records.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No records found matching your search criteria."
            }
          ]
        }
      }
      
      const formattedResults = records.map((record: any) => {
        const content = record.content?.gedcomx;
        const primaryPerson = content?.persons?.[0];
        
        const name = primaryPerson?.names?.[0]?.nameForms?.[0]?.fullText || record.title || 'Unknown';
        const gender = primaryPerson?.gender?.type?.replace('http://gedcomx.org/', '') || 'Unknown';
        
        const birthFact = primaryPerson?.facts?.find((f: any) => f.type === 'http://gedcomx.org/Birth');
        const deathFact = primaryPerson?.facts?.find((f: any) => f.type === 'http://gedcomx.org/Death');
        
        const birth = birthFact 
          ? `${birthFact.date?.original || 'Unknown date'} - ${birthFact.place?.original || 'Unknown place'}` 
          : 'Unknown';
          
        const death = deathFact 
          ? `${deathFact.date?.original || 'Unknown date'} - ${deathFact.place?.original || 'Unknown place'}` 
          : 'Unknown';
        
        const collection = content?.description?.title || 'Unknown collection';
        
        return {
          id: record.id,
          name,
          gender,
          birth,
          death,
          collection
        };
      });
      
      const resultsText = formattedResults.map((record: any, index: number) => 
        `${index + 1}. ${record.name} (${record.id})\n   Gender: ${record.gender}\n   Birth: ${record.birth}\n   Death: ${record.death}\n   Collection: ${record.collection}`
      ).join('\n\n');
      
      return {
        content: [
          {
            type: "text",
            text: `Found ${records.length} matching records:\n\n${resultsText}`
          }
        ]
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching records: ${error.message || JSON.stringify(error)}`
          }
        ]
      }
    }
  }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("FamilySearch server is running");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});