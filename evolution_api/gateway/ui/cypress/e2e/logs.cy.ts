describe('Logs Page', () => {
  beforeEach(() => {
    cy.mockConnectedState()
    cy.mockLogs()
    cy.visit('/')
    cy.goToTab('Logs')
  })

  describe('Messages Tab', () => {
    it('displays recent messages', () => {
      cy.wait('@getMessages')
      
      cy.contains('goodnight').should('be.visible')
      cy.contains('Hello everyone!').should('be.visible')
    })

    it('shows chat names', () => {
      cy.wait('@getMessages')
      
      cy.contains('John Doe').should('be.visible')
      cy.contains('Family Group').should('be.visible')
    })

    it('shows processed status', () => {
      cy.wait('@getMessages')
      
      cy.contains('Processed').should('be.visible')
      cy.contains('Received').should('be.visible')
    })

    it('can refresh messages', () => {
      cy.wait('@getMessages')
      
      cy.contains('button', 'Refresh').click()
      cy.wait('@getMessages')
    })

    it('can toggle auto-refresh', () => {
      cy.wait('@getMessages')
      
      cy.contains('Auto-refresh').click()
      
      // Should poll again after 5 seconds (wait for 2 polls)
      cy.wait('@getMessages')
      cy.wait('@getMessages', { timeout: 10000 })
    })
  })

  describe('Rule Executions Tab', () => {
    beforeEach(() => {
      cy.contains('button', 'Rule Executions').click()
    })

    it('displays rule fires', () => {
      cy.wait('@getRuleFires')
      
      cy.contains('Goodnight Routine').should('be.visible')
    })

    it('shows action types', () => {
      cy.wait('@getRuleFires')
      
      cy.contains('HA Service').should('be.visible')
      cy.contains('Reply').should('be.visible')
    })

    it('shows success status', () => {
      cy.wait('@getRuleFires')
      
      cy.contains('Success').should('be.visible')
    })

    it('can refresh rule fires', () => {
      cy.wait('@getRuleFires')
      
      cy.contains('button', 'Refresh').click()
      cy.wait('@getRuleFires')
    })
  })

  describe('Empty states', () => {
    it('shows empty message for messages', () => {
      cy.intercept('GET', '/api/logs/messages*', {
        statusCode: 200,
        body: [],
      }).as('getEmptyMessages')
      
      cy.visit('/')
      cy.goToTab('Logs')
      cy.wait('@getEmptyMessages')
      
      cy.contains('No messages yet').should('be.visible')
    })

    it('shows empty message for rule executions', () => {
      cy.intercept('GET', '/api/logs/rules*', {
        statusCode: 200,
        body: [],
      }).as('getEmptyRuleFires')
      
      cy.visit('/')
      cy.goToTab('Logs')
      cy.contains('button', 'Rule Executions').click()
      cy.wait('@getEmptyRuleFires')
      
      cy.contains('No rule executions yet').should('be.visible')
    })
  })

  describe('Pagination', () => {
    it('can load more messages', () => {
      // Return 50 messages to trigger "Load More"
      const manyMessages = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        chat_id: '31612345678@s.whatsapp.net',
        chat_name: 'John Doe',
        sender_id: '31612345678',
        content: `Message ${i + 1}`,
        message_type: 'text',
        is_from_me: false,
        received_at: new Date(Date.now() - i * 60000).toISOString(),
        processed: false,
      }))
      
      cy.intercept('GET', '/api/logs/messages*', {
        statusCode: 200,
        body: manyMessages,
      }).as('getManyMessages')
      
      cy.visit('/')
      cy.goToTab('Logs')
      cy.wait('@getManyMessages')
      
      cy.contains('button', 'Load More').should('be.visible')
      cy.contains('button', 'Load More').click()
      
      cy.wait('@getManyMessages')
    })
  })

  describe('Error handling', () => {
    it('handles API errors gracefully', () => {
      cy.intercept('GET', '/api/logs/messages*', {
        statusCode: 500,
        body: { error: 'Server error' },
      }).as('getMessagesError')
      
      cy.visit('/')
      cy.goToTab('Logs')
      cy.wait('@getMessagesError')
      
      // Should not crash the app
      cy.contains('Logs').should('be.visible')
    })
  })
})
