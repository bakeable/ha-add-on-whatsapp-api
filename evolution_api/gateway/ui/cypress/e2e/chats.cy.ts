describe('Chats Page', () => {
  beforeEach(() => {
    cy.mockConnectedState()
    cy.mockChats()
    cy.visit('/')
    cy.goToTab('Chats')
  })

  it('displays chat list', () => {
    cy.wait('@getChats')
    
    cy.contains('John Doe').should('be.visible')
    cy.contains('Jane Smith').should('be.visible')
    cy.contains('Family Group').should('be.visible')
    cy.contains('Work Team').should('be.visible')
  })

  it('shows chat types', () => {
    cy.wait('@getChats')
    
    // Check for type badges - UI shows "👤 Direct" and "👥 Group"
    cy.contains('John Doe').closest('tr').should('contain', 'Direct')
    cy.contains('Family Group').closest('tr').should('contain', 'Group')
  })

  it('can filter by type', () => {
    cy.wait('@getChats')
    
    // Filter to groups only
    cy.get('select').first().select('group')
    cy.wait('@getChats')
  })

  it('can search chats', () => {
    cy.wait('@getChats')
    
    cy.get('input[placeholder*="Search"]').type('John')
    
    cy.contains('John Doe').should('be.visible')
    cy.contains('Jane Smith').should('not.exist')
    cy.contains('Family Group').should('not.exist')
  })

  it('can toggle chat enabled status', () => {
    cy.wait('@getChats')
    
    // Find Jane Smith's row and click the checkbox
    cy.contains('Jane Smith')
      .closest('tr')
      .find('input[type="checkbox"]')
      .click()
    
    cy.wait('@updateChat')
  })

  it('can refresh chats from WhatsApp', () => {
    cy.wait('@getChats')
    
    // Stub window.alert to verify it's called
    cy.window().then((win) => {
      cy.stub(win, 'alert').as('alertStub')
    })
    
    cy.contains('button', 'Sync from WhatsApp').click()
    
    cy.wait('@refreshChats')
    cy.wait('@getChats')
    
    // Should show success message via alert
    cy.get('@alertStub').should('be.called')
  })

  it('shows enabled/disabled status correctly', () => {
    cy.wait('@getChats')
    
    // John Doe is enabled - checkbox should be checked
    cy.contains('John Doe')
      .closest('tr')
      .find('input[type="checkbox"]')
      .should('be.checked')
    
    // Jane Smith is disabled - checkbox should not be checked
    cy.contains('Jane Smith')
      .closest('tr')
      .find('input[type="checkbox"]')
      .should('not.be.checked')
  })

  describe('Empty state', () => {
    beforeEach(() => {
      cy.mockChats([])
      cy.visit('/')
      cy.goToTab('Chats')
    })

    it('shows empty message when no chats', () => {
      cy.wait('@getChats')
      cy.contains('No chats found').should('be.visible')
    })
  })
})
