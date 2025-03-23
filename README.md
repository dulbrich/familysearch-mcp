# FamilySearch MCP Server

This is a Model Context Protocol (MCP) server for FamilySearch APIs. It allows AI tools like Claude or Cursor to interact with FamilySearch's family history data directly.

## Features

- Authentication with FamilySearch credentials
- Search for person records in FamilySearch Family Tree
- View detailed person information
- Explore ancestors and descendants
- Search historical records

## Prerequisites

- Node.js 16+ and npm
- A FamilySearch developer account and API credentials
- A FamilySearch user account with access to Family Tree data

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

## FamilySearch API Setup

Before using this tool, you'll need to register for FamilySearch API access:

1. Go to [FamilySearch Developers](https://www.familysearch.org/developers/)
2. Sign in with your FamilySearch account
3. Create a new application
4. Set the redirect URI to `https://localhost:8080/oauth-redirect` (you can change this later)
5. Copy your Client ID - you'll need it for configuration

## Usage

Run the server:

```bash
npm start
```

Then, in your AI tool that supports MCP (like Claude or Cursor), you can use the FamilySearch tools to interact with family history data.

## Configuration

The first time you use the MCP, you'll need to configure it with your FamilySearch API credentials:

```
Configure FamilySearch API credentials with clientId: YOUR_CLIENT_ID_HERE
```

Then authenticate with your FamilySearch username and password:

```
Authenticate with FamilySearch using username: your_username and password: your_password
```

Once authenticated, your credentials will be stored securely in `~/.familysearch-mcp/config.json` for future use.

## Available MCP Tools

### Basic

- `say-hello`: A simple greeting function
- `configure`: Set up your FamilySearch API credentials
- `authenticate`: Log in to FamilySearch
- `get-current-user`: View details about your FamilySearch account

### Family Tree

- `search-persons`: Search for individuals in FamilySearch Family Tree
- `get-person`: View detailed information about a specific person
- `get-ancestors`: View a person's ancestors (up to 8 generations)
- `get-descendants`: View a person's descendants (up to 3 generations)

### Historical Records

- `search-records`: Search FamilySearch's historical record collections

## Example Queries

```
Search for persons with name: "John Smith" birthPlace: "New York"
```

```
Get person with personId: ABCD-123
```

```
Get ancestors for personId: ABCD-123 with generations: 4
```

```
Search records with surname: "Johnson" birthPlace: "England" deathDate: "1880-01-01"
```

## Security Notice

Your FamilySearch credentials are stored locally on your machine in `~/.familysearch-mcp/config.json`. Never share this file with others.

## License

ISC 