import { useEffect, useState } from 'react'
import { waApi } from '../api'

interface Chat {
  chat_id: string
  type: 'group' | 'direct'
  name: string
  enabled: boolean
  last_message_at?: string
}

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'group' | 'direct'>('all')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Load chats
  const loadChats = async () => {
    try {
      const data = await waApi.getChats({ type: filter === 'all' ? undefined : filter })
      setChats(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChats()
  }, [filter])

  // Refresh chats from Evolution API
  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const result = await waApi.refreshChats()
      
      // Show initial response
      if (result.status === 'started') {
        alert('✅ Chat sync started!\n\nChats are being fetched in the background.\nThis may take 1-2 minutes for large contact lists.\n\nClick "Refresh" below to see new chats as they appear.')
      }
      
      // Immediately reload to show any existing chats
      await loadChats()
      
      // Auto-refresh after a delay to show synced chats
      setTimeout(() => {
        loadChats().catch(console.error)
      }, 3000)
      
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRefreshing(false)
    }
  }

  // Toggle chat enabled
  const handleToggle = async (chat: Chat) => {
    try {
      await waApi.updateChat(chat.chat_id, { enabled: !chat.enabled })
      setChats(chats.map(c => 
        c.chat_id === chat.chat_id ? { ...c, enabled: !c.enabled } : c
      ))
    } catch (e: any) {
      setError(e.message)
    }
  }

  // Filter chats by search
  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(search.toLowerCase()) ||
    chat.chat_id.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="text-center py-8">Loading chats...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Chats</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn btn-primary"
        >
          {refreshing ? '🔄 Syncing...' : '🔄 Sync from WhatsApp'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search chats..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-600">Type:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="input max-w-[150px]"
            >
              <option value="all">All</option>
              <option value="group">Groups</option>
              <option value="direct">Direct</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chats Table */}
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Enabled
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Chat ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Last Message
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredChats.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  {chats.length === 0 
                    ? 'No chats found. Click "Sync from WhatsApp" to load your chats.'
                    : 'No chats match your search.'}
                </td>
              </tr>
            ) : (
              filteredChats.map((chat) => (
                <tr key={chat.chat_id} className={!chat.enabled ? 'bg-gray-50' : ''}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={chat.enabled}
                      onChange={() => handleToggle(chat)}
                      className="h-4 w-4 text-wa-green rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${
                      chat.type === 'group' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {chat.type === 'group' ? '👥 Group' : '👤 Direct'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{chat.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                    {chat.chat_id.length > 30 
                      ? `${chat.chat_id.substring(0, 30)}...`
                      : chat.chat_id}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {chat.last_message_at 
                      ? new Date(chat.last_message_at).toLocaleString()
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/rules?chat=${encodeURIComponent(chat.chat_id)}`}
                      className="text-ha-primary hover:text-ha-secondary text-sm"
                    >
                      Create Rule →
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-500">
        💡 Enable chats to allow rules to process messages from them.
        Only enabled chats will trigger automations.
      </p>
    </div>
  )
}
