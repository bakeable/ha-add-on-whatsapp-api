describe('Navigation', () => {
  beforeEach(() => {
    cy.mockConnectedState()
    cy.mockChats()
    cy.mockRules()
    cy.mockLogs()
    cy.visit('/')
  })

  it('displays header with app title', () => {
    cy.contains('WhatsApp Gateway API').should('be.visible')
  })

  it('shows all navigation tabs', () => {
    cy.contains('Setup').should('be.visible')
    cy.contains('Chats').should('be.visible')
    cy.contains('Rules').should('be.visible')
    cy.contains('Logs').should('be.visible')
  })

  it('defaults to Setup tab', () => {
    cy.contains('Connection Status').should('be.visible')
  })

  it('can navigate to Chats tab', () => {
    cy.goToTab('Chats')
    cy.wait('@getChats')
    cy.contains('Sync from WhatsApp').should('be.visible')
  })

  it('can navigate to Rules tab', () => {
    cy.goToTab('Rules')
    cy.wait('@getRules')
    cy.contains('YAML Editor').should('be.visible')
  })

  it('can navigate to Logs tab', () => {
    cy.goToTab('Logs')
    cy.wait('@getMessages')
    cy.contains('Messages').should('be.visible')
  })

  it('highlights active tab', () => {
    cy.goToTab('Chats')
    cy.contains('a', 'Chats').should('have.class', 'border-wa-dark')
    
    cy.goToTab('Rules')
    cy.contains('a', 'Rules').should('have.class', 'border-wa-dark')
  })

  it('preserves URL on refresh', () => {
    cy.goToTab('Chats')
    cy.reload()
    cy.url().should('include', '/chats')
    cy.contains('Sync from WhatsApp').should('be.visible')
  })
})
