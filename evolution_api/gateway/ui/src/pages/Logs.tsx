import { useCallback, useEffect, useState } from 'react'
import { logsApi } from '../api'

interface Message {
  id: number
  chat_id: string
  chat_name: string
  sender_id: string
  content: string
  message_type: string
  is_from_me: boolean
  provider_message_id: string
  received_at: string
  processed: boolean
}

interface RuleFire {
  id: number
  rule_id: string
  rule_name: string
  message_id: number
  chat_id: string
  action_type: string
  action_details: string
  success: boolean
  error_message: string | null
  fired_at: string
}

export default function LogsPage() {
  const [tab, setTab] = useState<'messages' | 'rules'>('messages')
  const [messages, setMessages] = useState<Message[]>([])
  const [ruleFires, setRuleFires] = useState<RuleFire[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const limit = 50

  // Load data
  const loadMessages = useCallback(async (reset = false) => {
    if (loading) return
    setLoading(true)
    try {
      const p = reset ? 1 : page
      const data = await logsApi.getMessages({ page: p, limit })
      if (reset) {
        setMessages(data)
        setPage(1)
      } else {
        setMessages(prev => [...prev, ...data])
      }
      setHasMore(data.length === limit)
      if (!reset) setPage(p + 1)
    } catch (e) {
      console.error('Failed to load messages:', e)
    } finally {
      setLoading(false)
    }
  }, [loading, page])

  const loadRuleFires = useCallback(async (reset = false) => {
    if (loading) return
    setLoading(true)
    try {
      const p = reset ? 1 : page
      const data = await logsApi.getRuleFires({ page: p, limit })
      if (reset) {
        setRuleFires(data)
        setPage(1)
      } else {
        setRuleFires(prev => [...prev, ...data])
      }
      setHasMore(data.length === limit)
      if (!reset) setPage(p + 1)
    } catch (e) {
      console.error('Failed to load rule fires:', e)
    } finally {
      setLoading(false)
    }
  }, [loading, page])

  // Initial load
  useEffect(() => {
    if (tab === 'messages') {
      loadMessages(true)
    } else {
      loadRuleFires(true)
    }
  }, [tab])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      if (tab === 'messages') {
        loadMessages(true)
      } else {
        loadRuleFires(true)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, tab])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString()
  }

  const loadMore = () => {
    if (tab === 'messages') {
      loadMessages()
    } else {
      loadRuleFires()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-mushroom-text">Logs</h2>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-sm text-mushroom-text-secondary">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-mushroom-bg border-mushroom-border text-primary focus:ring-primary/30"
            />
            <span>Auto-refresh (5s)</span>
          </label>
          <button
            onClick={() => tab === 'messages' ? loadMessages(true) : loadRuleFires(true)}
            className="btn btn-secondary"
            disabled={loading}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-mushroom-border">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setTab('messages')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              tab === 'messages'
                ? 'border-primary text-primary'
                : 'border-transparent text-mushroom-text-secondary hover:text-mushroom-text hover:border-mushroom-accent'
            }`}
          >
            📨 Messages
          </button>
          <button
            onClick={() => setTab('rules')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              tab === 'rules'
                ? 'border-primary text-primary'
                : 'border-transparent text-mushroom-text-secondary hover:text-mushroom-text hover:border-mushroom-accent'
            }`}
          >
            ⚡ Rule Executions
          </button>
        </nav>
      </div>

      {tab === 'messages' ? (
        <MessagesTable messages={messages} formatDate={formatDate} />
      ) : (
        <RuleFiresTable ruleFires={ruleFires} formatDate={formatDate} />
      )}

      {/* Load More */}
      {hasMore && (
        <div className="text-center">
          <button onClick={loadMore} className="btn btn-secondary" disabled={loading}>
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && ((tab === 'messages' && messages.length === 0) || (tab === 'rules' && ruleFires.length === 0)) && (
        <div className="text-center py-12 text-mushroom-text-muted">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-mushroom-text-secondary">No {tab === 'messages' ? 'messages' : 'rule executions'} yet.</p>
          <p className="text-sm mt-1">
            {tab === 'messages'
              ? 'Send a message to your WhatsApp account to see it here.'
              : 'Configure some rules and send matching messages.'}
          </p>
        </div>
      )}
    </div>
  )
}

function MessagesTable({ messages, formatDate }: { messages: Message[]; formatDate: (d: string) => string }) {
  return (
    <div className="overflow-x-auto card p-0">
      <table className="min-w-full divide-y divide-mushroom-border">
        <thead className="bg-mushroom-bg-secondary">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Time
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Chat
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Sender
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Message
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-mushroom-border">
          {messages.map((msg) => (
            <tr key={msg.id} className={`transition-colors ${msg.is_from_me ? 'bg-info-muted' : 'hover:bg-mushroom-card-hover'}`}>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-mushroom-text-muted">
                {formatDate(msg.received_at)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm font-medium text-mushroom-text">{msg.chat_name || msg.chat_id}</div>
                <div className="text-xs text-mushroom-text-muted truncate max-w-[150px]">{msg.chat_id}</div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-mushroom-text">
                {msg.is_from_me ? (
                  <span className="text-info-text">You</span>
                ) : (
                  <span>{msg.sender_id}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="text-sm text-mushroom-text max-w-md truncate" title={msg.content}>
                  {msg.message_type !== 'text' && (
                    <span className="inline-block px-2 py-0.5 bg-mushroom-bg text-mushroom-text-secondary rounded text-xs mr-2">
                      {msg.message_type}
                    </span>
                  )}
                  {msg.content || <span className="text-mushroom-text-muted italic">(no text)</span>}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {msg.processed ? (
                  <span className="status-badge status-connected">
                    ✓ Processed
                  </span>
                ) : (
                  <span className="status-badge bg-mushroom-bg text-mushroom-text-secondary">
                    Received
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RuleFiresTable({ ruleFires, formatDate }: { ruleFires: RuleFire[]; formatDate: (d: string) => string }) {
  return (
    <div className="overflow-x-auto card p-0">
      <table className="min-w-full divide-y divide-mushroom-border">
        <thead className="bg-mushroom-bg-secondary">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Time
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Rule
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Action
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Details
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-mushroom-border">
          {ruleFires.map((fire) => (
            <tr key={fire.id} className={`transition-colors ${fire.success ? 'hover:bg-mushroom-card-hover' : 'bg-danger-muted'}`}>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-mushroom-text-muted">
                {formatDate(fire.fired_at)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm font-medium text-mushroom-text">{fire.rule_name}</div>
                <div className="text-xs text-mushroom-text-muted">{fire.rule_id}</div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`status-badge ${
                  fire.action_type === 'ha_service' 
                    ? 'bg-info-muted text-info-text' 
                    : 'bg-whatsapp-muted text-whatsapp'
                }`}>
                  {fire.action_type === 'ha_service' ? '🏠 HA Service' : '💬 Reply'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="text-sm text-mushroom-text max-w-md truncate" title={fire.action_details}>
                  {fire.action_details}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {fire.success ? (
                  <span className="status-badge status-connected">
                    ✓ Success
                  </span>
                ) : (
                  <div>
                    <span className="status-badge status-disconnected">
                      ✗ Failed
                    </span>
                    {fire.error_message && (
                      <div className="text-xs text-danger-text mt-1 max-w-xs truncate" title={fire.error_message}>
                        {fire.error_message}
                      </div>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
