import { NextRequest } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { resolveApiToken } from '@/lib/apiTokens';
import { registerMcpTools } from '@/lib/mcpTools';
import { getOrigin } from '@/lib/oauth';

export const dynamic = 'force-dynamic';

// RFC 9728 — a 401 here (whether no token was sent, or it's invalid/expired)
// points the client at the protected-resource metadata, which in turn points
// at the authorization server. This is what lets a client that only has this
// URL — no token yet — discover and start the OAuth flow on its own.
function unauthorized() {
  const origin = getOrigin();
  return new Response(JSON.stringify({ error: 'invalid_token', error_description: 'Missing or invalid access token' }), {
    status: 401,
    headers: {
      'Content-Type':     'application/json',
      'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    },
  });
}

async function handle(req: NextRequest): Promise<Response> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return unauthorized();

  const token = authHeader.slice(7).trim();
  const user  = await resolveApiToken(token);
  if (!user) return unauthorized();

  // Serverless-friendly: a fresh server+transport per request (stateless
  // mode — no sessionIdGenerator), since nothing here persists in-process
  // memory between invocations anyway.
  const server = new McpServer({ name: 'deep-impression-desk', version: '1.0.0' });
  registerMcpTools(server, { baseUrl: getOrigin(), token });

  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  return transport.handleRequest(req);
}

export async function POST(req: NextRequest)   { return handle(req); }
export async function GET(req: NextRequest)    { return handle(req); }
export async function DELETE(req: NextRequest) { return handle(req); }
