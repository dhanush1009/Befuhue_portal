'use client';

import { useState } from 'react';
import { Bot, Plus, Copy, Check, Loader2, Trash2, KeyRound, AlertTriangle, Globe, Terminal, ChevronDown, ShieldCheck } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useApiTokens, useCreateApiToken, useRevokeApiToken } from '@/hooks/useApiTokens';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

const IC = 'w-full px-3 py-2 text-sm bg-gray-50 dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-violet-900/40 text-gray-600 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150 shrink-0"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-status-present" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

export function ConnectLLMTab() {
  const { data: tokens = [], isLoading } = useApiTokens();
  const createToken = useCreateApiToken();
  const revokeToken = useRevokeApiToken();

  const [showLocalSetup, setShowLocalSetup] = useState(false);
  const [showNewForm, setShowNewForm]       = useState(false);
  const [nameDraft,   setNameDraft]         = useState('');
  const [freshToken,  setFreshToken]        = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const apiOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://desk.your-domain.example';
  const mcpUrl = `${apiOrigin}/api/mcp`;

  function handleCreate() {
    if (!nameDraft.trim()) return;
    createToken.mutate(nameDraft.trim(), {
      onSuccess: (created) => {
        setFreshToken(created.token);
        setNameDraft('');
        setShowNewForm(false);
      },
    });
  }

  const mcpConfigSnippet = freshToken ? JSON.stringify({
    mcpServers: {
      'deep-impression-desk': {
        command: 'node',
        args:    ['/path/to/Internal_Portal/mcp-server/dist/index.js'],
        env: {
          DESK_API_URL:   apiOrigin,
          DESK_API_TOKEN: freshToken,
        },
      },
    },
  }, null, 2) : '';

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bot className="w-4.5 h-4.5 text-brand" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Connect Your LLM</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-violet-300/55 leading-relaxed max-w-xl">
          Let an MCP-compatible LLM client read tasks, clients, and projects from this portal, and create
          tasks, change status, or manage dependencies on your behalf — using the same permissions as your
          own login.
        </p>
      </div>

      {/* ── Remote (OAuth) — the recommended path, works like any other connector ── */}
      <div className="rounded-xl border border-brand/20 dark:border-violet-500/30 bg-brand/5 dark:bg-violet-500/10 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="w-4 h-4 text-brand dark:text-violet-300" />
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Remote — Claude.ai, ChatGPT, and other cloud clients</p>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand text-white">Recommended</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-violet-300/55 mb-3">
          Paste this URL into your LLM app&apos;s &ldquo;Add custom connector&rdquo; or &ldquo;Add MCP server&rdquo; dialog.
          You&apos;ll be sent here to log in and approve access — no token to copy or manage.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-lg px-3 py-2 overflow-x-auto whitespace-nowrap text-gray-800 dark:text-violet-100">
            {mcpUrl}
          </code>
          <CopyButton value={mcpUrl} label="Copy URL" />
        </div>
        <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-gray-500 dark:text-violet-300/50">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          Access expires automatically and refreshes itself while connected; revoke anytime below.
        </div>
      </div>

      {/* ── Local (stdio) — power-user / CLI setup, collapsed by default ── */}
      <div className="rounded-xl border border-gray-200 dark:border-violet-900/40">
        <button
          onClick={() => setShowLocalSetup((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left"
        >
          <Terminal className="w-4 h-4 text-gray-400 dark:text-violet-400/60 shrink-0" />
          <span className="flex-1 text-sm font-medium text-gray-700 dark:text-violet-200/80">
            Local setup — Claude Code, Claude Desktop config file, Cursor
          </span>
          <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform duration-150', showLocalSetup && 'rotate-180')} />
        </button>

        {showLocalSetup && (
          <div className="px-4 pb-4 space-y-4 border-t border-gray-100 dark:border-violet-900/30 pt-4">
            <p className="text-xs text-gray-500 dark:text-violet-300/55">
              For clients that run a local process instead of connecting to a URL, generate a personal
              access token and point them at the <code className="font-mono">mcp-server</code> package in the
              portal&apos;s repo.
            </p>

            {freshToken && (
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Copy this token now — you won&apos;t be able to see it again. Anyone with this token can act on the portal as you.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-white dark:bg-surface-dark-2 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 overflow-x-auto whitespace-nowrap text-gray-800 dark:text-violet-100">
                    {freshToken}
                  </code>
                  <CopyButton value={freshToken} label="Copy token" />
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1.5 mt-3">
                    MCP config
                  </p>
                  <div className="relative">
                    <pre className="text-[11px] font-mono bg-gray-900 dark:bg-black/40 text-gray-100 rounded-lg p-3 overflow-x-auto leading-relaxed">
                      {mcpConfigSnippet}
                    </pre>
                    <div className="absolute top-2 right-2">
                      <CopyButton value={mcpConfigSnippet} label="Copy config" />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-violet-300/45 mt-1.5">
                    Point <code className="font-mono">args</code> at where you&apos;ve built the <code className="font-mono">mcp-server</code> package
                    (see <code className="font-mono">mcp-server/README.md</code>), then restart your LLM client.
                  </p>
                </div>

                <button
                  onClick={() => setFreshToken(null)}
                  className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
                >
                  Done, I&apos;ve saved it
                </button>
              </div>
            )}

            {showNewForm && !freshToken && (
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-surface-dark-2 rounded-lg p-3">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewForm(false); }}
                  placeholder="e.g. Claude Code"
                  className={IC}
                />
                <button
                  onClick={handleCreate}
                  disabled={!nameDraft.trim() || createToken.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors duration-150 shrink-0"
                >
                  {createToken.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Create
                </button>
                <button
                  onClick={() => setShowNewForm(false)}
                  className="px-3 py-2 text-sm text-gray-500 dark:text-violet-300/55 hover:bg-gray-100 dark:hover:bg-surface-dark-3 rounded-lg transition-colors duration-150 shrink-0"
                >
                  Cancel
                </button>
              </div>
            )}

            {!showNewForm && !freshToken && (
              <button
                onClick={() => setShowNewForm(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                New Token
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Connections list — both remote (OAuth) and local (manual) ── */}
      <div>
        <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-2">Your Connections</p>
        {isLoading ? (
          <p className="text-xs text-gray-400 dark:text-violet-300/45">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-violet-300/45 italic">Nothing connected yet.</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => (
              <div
                key={t.id}
                className={cn(
                  'flex items-center justify-between gap-3 bg-gray-50 dark:bg-surface-dark-2 rounded-lg px-4 py-3',
                  t.revokedAt && 'opacity-50',
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {t.source === 'oauth' ? <Globe className="w-4 h-4 text-brand dark:text-violet-300 shrink-0" /> : <KeyRound className="w-4 h-4 text-gray-400 dark:text-violet-400/60 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {t.name}
                      {t.revokedAt && <span className="ml-2 text-[11px] font-normal text-status-absent">Revoked</span>}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-violet-300/45 font-mono">
                      {t.source === 'oauth' ? 'Remote connection' : `${t.tokenPrefix}…`} · connected {formatDate(t.createdAt)}
                      {t.lastUsedAt ? ` · last used ${formatDate(t.lastUsedAt)}` : ' · never used'}
                    </p>
                  </div>
                </div>
                {!t.revokedAt && (
                  <button
                    onClick={() => setConfirmRevokeId(t.id)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-status-absent hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150 shrink-0"
                    title="Revoke"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmRevokeId}
        title="Revoke Access"
        description="Any client using this will immediately lose access. This cannot be undone."
        confirmLabel="Revoke"
        destructive
        onConfirm={() => { if (confirmRevokeId) revokeToken.mutate(confirmRevokeId); setConfirmRevokeId(null); }}
        onCancel={() => setConfirmRevokeId(null)}
      />
    </div>
  );
}
