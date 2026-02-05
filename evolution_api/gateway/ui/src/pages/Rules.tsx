import Editor from '@monaco-editor/react'
import yaml from 'js-yaml'
import { useCallback, useEffect, useState } from 'react'
import { haApi, rulesApi, waApi } from '../api'

interface ValidationError {
  path: string
  message: string
  line?: number
}

interface HAEntity {
  entity_id: string
  name: string
  icon?: string
}

interface Chat {
  chat_id: string
  name: string
  type: 'group' | 'direct'
}

const DEFAULT_RULES = `version: 1
rules:
  # Example rule - customize or delete this
  - id: example_goodnight
    name: Goodnight Routine Example
    enabled: false
    priority: 100
    stop_on_match: true
    match:
      chat:
        type: direct  # direct, group, or any
      text:
        contains:
          - "goodnight"
          - "welterusten"
    actions:
      - type: ha_service
        service: script.turn_on
        target:
          entity_id: script.goodnight_routine
      - type: reply_whatsapp
        text: "✅ Goodnight routine started!"
    cooldown_seconds: 60
`

export default function RulesPage() {
  const [yamlContent, setYamlContent] = useState('')
  const [originalYaml, setOriginalYaml] = useState('')
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [view, setView] = useState<'yaml' | 'builder'>('yaml')
  
  // For guided builder
  const [scripts, setScripts] = useState<HAEntity[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [testMessage, setTestMessage] = useState({ chat_id: '', sender_id: '', text: '' })
  const [testResult, setTestResult] = useState<any>(null)

  // Load rules and entities
  useEffect(() => {
    loadRules()
    loadEntities()
  }, [])

  // Track changes
  useEffect(() => {
    setHasChanges(yamlContent !== originalYaml)
  }, [yamlContent, originalYaml])

  const loadRules = async () => {
    try {
      const data = await rulesApi.getRules()
      const yaml = data.yaml || DEFAULT_RULES
      setYamlContent(yaml)
      setOriginalYaml(yaml)
    } catch (e) {
      console.error('Failed to load rules:', e)
      setYamlContent(DEFAULT_RULES)
      setOriginalYaml(DEFAULT_RULES)
    }
  }

  const loadEntities = async () => {
    try {
      const [scriptsData, chatsData] = await Promise.all([
        haApi.getScripts(),
        waApi.getChats({ enabled: true }),
      ])
      setScripts(scriptsData)
      setChats(chatsData)
    } catch (e) {
      console.error('Failed to load entities:', e)
    }
  }

  // Validate YAML
  const validateYaml = useCallback(async (content: string) => {
    setValidating(true)
    try {
      const result = await rulesApi.validate(content)
      setValidationErrors(result.errors || [])
    } catch (e: any) {
      setValidationErrors([{ path: '', message: e.message }])
    } finally {
      setValidating(false)
    }
  }, [])

  // Debounced validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (yamlContent) {
        validateYaml(yamlContent)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [yamlContent, validateYaml])

  // Save rules
  const handleSave = async () => {
    setSaving(true)
    try {
      await rulesApi.saveRules(yamlContent)
      setOriginalYaml(yamlContent)
      setHasChanges(false)
      alert('Rules saved successfully!')
    } catch (e: any) {
      alert(`Failed to save: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Test rules
  const handleTest = async () => {
    try {
      const result = await rulesApi.test(testMessage)
      setTestResult(result)
    } catch (e: any) {
      alert(`Test failed: ${e.message}`)
    }
  }

  // Add rule from builder
  const addRuleFromBuilder = (rule: any) => {
    try {
      const current = yaml.load(yamlContent) as any
      current.rules = current.rules || []
      current.rules.push(rule)
      setYamlContent(yaml.dump(current, { indent: 2 }))
      setView('yaml')
    } catch (e) {
      alert('Failed to add rule to YAML')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-mushroom-text">Rules</h2>
        <div className="flex items-center space-x-2">
          <div className="flex rounded-mushroom overflow-hidden border border-mushroom-border">
            <button
              onClick={() => setView('yaml')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                view === 'yaml'
                  ? 'bg-primary text-white'
                  : 'bg-mushroom-card text-mushroom-text-secondary hover:bg-mushroom-card-hover'
              }`}
            >
              📝 YAML Editor
            </button>
            <button
              onClick={() => setView('builder')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                view === 'builder'
                  ? 'bg-primary text-white'
                  : 'bg-mushroom-card text-mushroom-text-secondary hover:bg-mushroom-card-hover'
              }`}
            >
              🔧 Guided Builder
            </button>
          </div>
          {view === 'yaml' && (
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges || validationErrors.length > 0}
              className="btn btn-success"
            >
              {saving ? 'Saving...' : hasChanges ? '💾 Save Rules' : '✓ Saved'}
            </button>
          )}
        </div>
      </div>

      {view === 'yaml' ? (
        <div className="space-y-4">
          {/* Validation Status */}
          <div className="flex items-center space-x-4">
            <span className="text-sm text-mushroom-text-secondary">
              {validating ? '⏳ Validating...' : 
               validationErrors.length === 0 ? '✅ Valid YAML' : 
               `❌ ${validationErrors.length} error(s)`}
            </span>
            {hasChanges && (
              <span className="text-sm text-warning-text">● Unsaved changes</span>
            )}
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="p-4 bg-danger-muted border border-danger/30 rounded-mushroom">
              <h4 className="font-medium text-danger-text mb-2">Validation Errors:</h4>
              <ul className="text-sm text-danger-text/80 space-y-1">
                {validationErrors.map((err, i) => (
                  <li key={i}>
                    {err.path && <code className="bg-danger/20 px-1 rounded">{err.path}</code>}
                    {err.path && ': '}
                    {err.message}
                    {err.line && <span className="text-danger-text/60"> (line {err.line})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Monaco Editor */}
          <div className="monaco-container h-[500px]">
            <Editor
              height="100%"
              defaultLanguage="yaml"
              value={yamlContent}
              onChange={(value) => setYamlContent(value || '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>

          {/* Test Panel */}
          <div className="card">
            <h3 className="font-medium text-mushroom-text mb-3">🧪 Test Rules</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="label">Chat ID</label>
                <select
                  value={testMessage.chat_id}
                  onChange={(e) => setTestMessage({ ...testMessage, chat_id: e.target.value })}
                  className="input"
                >
                  <option value="">Select a chat...</option>
                  {chats.map((chat) => (
                    <option key={chat.chat_id} value={chat.chat_id}>
                      {chat.name} ({chat.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Sender ID</label>
                <input
                  type="text"
                  value={testMessage.sender_id}
                  onChange={(e) => setTestMessage({ ...testMessage, sender_id: e.target.value })}
                  className="input"
                  placeholder="e.g., 31612345678"
                />
              </div>
              <div>
                <label className="label">Message Text</label>
                <input
                  type="text"
                  value={testMessage.text}
                  onChange={(e) => setTestMessage({ ...testMessage, text: e.target.value })}
                  className="input"
                  placeholder="e.g., goodnight"
                />
              </div>
            </div>
            <button onClick={handleTest} className="btn btn-primary" disabled={!testMessage.text}>
              Run Test
            </button>

            {testResult && (
              <div className="mt-3 p-4 bg-mushroom-bg-secondary rounded-mushroom">
                <h4 className="font-medium text-mushroom-text mb-2">
                  {testResult.matched_rules.length > 0 ? '✅ Matched Rules:' : '❌ No rules matched'}
                </h4>
                {testResult.matched_rules.map((rule: any) => (
                  <div key={rule.id} className="text-sm mb-2 text-mushroom-text">
                    <strong>{rule.name}</strong> ({rule.id})
                    <span className="text-mushroom-text-muted ml-2">— {rule.reason}</span>
                  </div>
                ))}
                {testResult.actions_preview.length > 0 && (
                  <>
                    <h4 className="font-medium text-mushroom-text mt-3 mb-2">Actions that would execute:</h4>
                    {testResult.actions_preview.map((action: any, i: number) => (
                      <div key={i} className="text-sm text-mushroom-text-secondary">
                        • {action.details}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <GuidedBuilder
          scripts={scripts}
          chats={chats}
          onAddRule={addRuleFromBuilder}
        />
      )}
    </div>
  )
}

// Guided Builder Component
function GuidedBuilder({
  scripts,
  chats,
  onAddRule,
}: {
  scripts: HAEntity[]
  chats: Chat[]
  onAddRule: (rule: any) => void
}) {
  const [rule, setRule] = useState({
    id: '',
    name: '',
    enabled: true,
    priority: 100,
    stop_on_match: true,
    cooldown_seconds: 0,
    match: {
      chat: { type: 'any' as const, ids: [] as string[] },
      sender: { ids: [] as string[] },
      text: { contains: [] as string[], starts_with: '', regex: '' },
    },
    actions: [] as any[],
  })
  const [containsInput, setContainsInput] = useState('')
  const [preview, setPreview] = useState('')

  // Update preview
  useEffect(() => {
    const cleanRule: any = { ...rule }
    // Clean up empty arrays/strings
    if (cleanRule.match?.chat?.ids?.length === 0) delete cleanRule.match.chat.ids
    if (cleanRule.match?.sender?.ids?.length === 0) delete cleanRule.match.sender
    if (cleanRule.match?.text?.contains?.length === 0) delete cleanRule.match.text.contains
    if (!cleanRule.match?.text?.starts_with) delete cleanRule.match?.text?.starts_with
    if (!cleanRule.match?.text?.regex) delete cleanRule.match?.text?.regex
    if (Object.keys(cleanRule.match?.text || {}).length === 0) delete cleanRule.match?.text
    if (!cleanRule.cooldown_seconds) delete cleanRule.cooldown_seconds

    setPreview(yaml.dump(cleanRule, { indent: 2 }))
  }, [rule])

  const addContains = () => {
    if (containsInput.trim()) {
      setRule({
        ...rule,
        match: {
          ...rule.match,
          text: {
            ...rule.match?.text,
            contains: [...(rule.match?.text?.contains || []), containsInput.trim()],
          },
        },
      })
      setContainsInput('')
    }
  }

  const removeContains = (index: number) => {
    setRule({
      ...rule,
      match: {
        ...rule.match,
        text: {
          ...rule.match?.text,
          contains: (rule.match?.text?.contains || []).filter((_, i) => i !== index),
        },
      },
    })
  }

  const addAction = (type: 'ha_service' | 'reply_whatsapp') => {
    if (type === 'ha_service') {
      setRule({
        ...rule,
        actions: [...rule.actions, { type, service: 'script.turn_on', target: { entity_id: '' } }],
      })
    } else {
      setRule({
        ...rule,
        actions: [...rule.actions, { type, text: '' }],
      })
    }
  }

  const updateAction = (index: number, updates: any) => {
    setRule({
      ...rule,
      actions: rule.actions.map((a, i) => (i === index ? { ...a, ...updates } : a)),
    })
  }

  const removeAction = (index: number) => {
    setRule({ ...rule, actions: rule.actions.filter((_, i) => i !== index) })
  }

  const handleAdd = () => {
    if (!rule.id || !rule.name || rule.actions.length === 0) {
      alert('Please fill in rule ID, name, and at least one action')
      return
    }
    onAddRule(rule)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="space-y-4">
        <div className="card">
          <h3 className="font-medium text-mushroom-text mb-3">Basic Info</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Rule ID *</label>
              <input
                type="text"
                value={rule.id}
                onChange={(e) => setRule({ ...rule, id: e.target.value.replace(/\s/g, '_') })}
                className="input"
                placeholder="e.g., goodnight_routine"
              />
            </div>
            <div>
              <label className="label">Rule Name *</label>
              <input
                type="text"
                value={rule.name}
                onChange={(e) => setRule({ ...rule, name: e.target.value })}
                className="input"
                placeholder="e.g., Goodnight Routine"
              />
            </div>
            <div>
              <label className="label">Priority</label>
              <input
                type="number"
                value={rule.priority}
                onChange={(e) => setRule({ ...rule, priority: parseInt(e.target.value) || 100 })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Cooldown (seconds)</label>
              <input
                type="number"
                value={rule.cooldown_seconds}
                onChange={(e) => setRule({ ...rule, cooldown_seconds: parseInt(e.target.value) || 0 })}
                className="input"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4 mt-3">
            <label className="flex items-center space-x-2 text-mushroom-text-secondary">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(e) => setRule({ ...rule, enabled: e.target.checked })}
                className="rounded bg-mushroom-bg border-mushroom-border text-primary focus:ring-primary/30"
              />
              <span>Enabled</span>
            </label>
            <label className="flex items-center space-x-2 text-mushroom-text-secondary">
              <input
                type="checkbox"
                checked={rule.stop_on_match}
                onChange={(e) => setRule({ ...rule, stop_on_match: e.target.checked })}
                className="rounded bg-mushroom-bg border-mushroom-border text-primary focus:ring-primary/30"
              />
              <span>Stop on match</span>
            </label>
          </div>
        </div>

        <div className="card">
          <h3 className="font-medium text-mushroom-text mb-3">Match Conditions</h3>
          <div className="space-y-3">
            <div>
              <label className="label">Chat Type</label>
              <select
                value={rule.match.chat.type}
                onChange={(e) => setRule({
                  ...rule,
                  match: { ...rule.match, chat: { ...rule.match.chat, type: e.target.value as any } }
                })}
                className="input"
              >
                <option value="any">Any</option>
                <option value="direct">Direct Messages</option>
                <option value="group">Groups</option>
              </select>
            </div>
            <div>
              <label className="label">Specific Chat (optional)</label>
              <select
                value={rule.match.chat?.ids?.[0] || ''}
                onChange={(e) => setRule({
                  ...rule,
                  match: { ...rule.match, chat: { ...rule.match.chat, ids: e.target.value ? [e.target.value] : [] } }
                })}
                className="input"
              >
                <option value="">Any chat</option>
                {chats.map((chat) => (
                  <option key={chat.chat_id} value={chat.chat_id}>
                    {chat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Text Contains</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={containsInput}
                  onChange={(e) => setContainsInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addContains()}
                  className="input flex-1"
                  placeholder="Type keyword and press Enter"
                />
                <button onClick={addContains} className="btn btn-secondary">Add</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {(rule.match.text?.contains || []).map((kw, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-1 bg-whatsapp-muted text-whatsapp rounded-full text-sm"
                  >
                    {kw}
                    <button onClick={() => removeContains(i)} className="ml-1 hover:text-danger-text">×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-medium text-mushroom-text mb-3">Actions *</h3>
          <div className="space-y-3">
            {rule.actions.map((action, i) => (
              <div key={i} className="p-3 bg-mushroom-bg-secondary rounded-mushroom">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-mushroom-text">
                    {action.type === 'ha_service' ? '🏠 HA Service' : '💬 WhatsApp Reply'}
                  </span>
                  <button onClick={() => removeAction(i)} className="text-danger-text hover:text-danger">
                    Remove
                  </button>
                </div>
                {action.type === 'ha_service' ? (
                  <div className="space-y-2">
                    <select
                      value={action.target?.entity_id || ''}
                      onChange={(e) => updateAction(i, { target: { entity_id: e.target.value } })}
                      className="input"
                    >
                      <option value="">Select a script...</option>
                      {scripts.map((s) => (
                        <option key={s.entity_id} value={s.entity_id}>
                          {s.name || s.entity_id}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={action.text || ''}
                    onChange={(e) => updateAction(i, { text: e.target.value })}
                    className="input"
                    placeholder="Reply message..."
                  />
                )}
              </div>
            ))}
            <div className="flex space-x-2">
              <button onClick={() => addAction('ha_service')} className="btn btn-secondary flex-1">
                + Call HA Script
              </button>
              <button onClick={() => addAction('reply_whatsapp')} className="btn btn-secondary flex-1">
                + WhatsApp Reply
              </button>
            </div>
          </div>
        </div>

        <button onClick={handleAdd} className="btn btn-success w-full">
          ➕ Add Rule to YAML
        </button>
      </div>

      {/* Preview */}
      <div>
        <div className="card sticky top-4">
          <h3 className="font-medium text-mushroom-text mb-3">YAML Preview</h3>
          <pre className="bg-mushroom-bg p-4 rounded-mushroom overflow-x-auto text-sm text-mushroom-text-secondary border border-mushroom-border">
            {preview}
          </pre>
        </div>
      </div>
    </div>
  )
}
