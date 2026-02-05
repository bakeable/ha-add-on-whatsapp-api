describe('Setup Page', () => {
  describe('When disconnected', () => {
    beforeEach(() => {
      cy.mockDisconnectedState()
      cy.visit('/')
    })

    it('shows disconnected status', () => {
      cy.wait('@getWaStatus')
      cy.wait('@getHaStatus')
      
      cy.contains('Evolution API:').parent().should('contain', 'disconnected')
      cy.contains('Home Assistant:').parent().should('contain', 'connected')
    })

    it('shows Generate QR Code button', () => {
      cy.contains('button', 'Generate QR Code').should('be.visible')
    })

    it('can generate QR code', () => {
      cy.contains('button', 'Generate QR Code').click()
      
      cy.wait('@createInstance')
      cy.wait('@connectInstance')
      
      // QR code should be displayed
      cy.get('img[alt="WhatsApp QR Code"]').should('be.visible')
      cy.contains('Scan this QR code with WhatsApp').should('be.visible')
    })

    it('shows connection instructions', () => {
      cy.contains('button', 'Generate QR Code').click()
      cy.wait('@connectInstance')
      
      cy.contains('Open WhatsApp on your phone').should('be.visible')
      cy.contains('Go to Settings → Linked Devices').should('be.visible')
      cy.contains('Tap "Link a Device"').should('be.visible')
      cy.contains('Scan the QR code below').should('be.visible')
    })

    it('can cancel QR code generation', () => {
      cy.contains('button', 'Generate QR Code').click()
      cy.wait('@connectInstance')
      
      cy.contains('button', 'Cancel').click()
      cy.get('img[alt="WhatsApp QR Code"]').should('not.exist')
    })
  })

  describe('When connected', () => {
    beforeEach(() => {
      cy.mockConnectedState()
      cy.visit('/')
    })

    it('shows connected status', () => {
      cy.wait('@getWaStatus')
      cy.wait('@getHaStatus')
      
      cy.contains('Evolution API:').parent().should('contain', 'connected')
      cy.contains('Home Assistant:').parent().should('contain', 'connected')
    })

    it('shows connected message', () => {
      cy.contains('WhatsApp Connected').should('be.visible')
      cy.contains('Instance "HomeAssistant" is connected').should('be.visible')
    })

    it('shows Disconnect button', () => {
      cy.contains('button', 'Disconnect').should('be.visible')
    })

    it('can refresh status', () => {
      cy.contains('button', 'Refresh Status').click()
      cy.wait('@getWaStatus')
      cy.wait('@getHaStatus')
    })
  })

  describe('Quick Start instructions', () => {
    beforeEach(() => {
      cy.mockConnectedState()
      cy.visit('/')
    })

    it('shows quick start guide', () => {
      cy.contains('Quick Start').should('be.visible')
      cy.contains('Connect your WhatsApp').should('be.visible')
      cy.contains('Chats').should('be.visible')
      cy.contains('Rules').should('be.visible')
      cy.contains('Logs').should('be.visible')
    })
  })
})
