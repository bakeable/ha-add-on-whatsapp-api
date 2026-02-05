describe('Rules Page', () => {
  beforeEach(() => {
    cy.mockConnectedState()
    cy.mockRules()
    cy.mockChats()
    cy.visit('/')
    cy.goToTab('Rules')
  })

  describe('YAML Editor', () => {
    it('loads existing rules', () => {
      cy.wait('@getRules')
      
      // Monaco editor should contain the rules
      cy.get('.monaco-editor').should('be.visible')
    })

    it('shows valid status for valid YAML', () => {
      cy.wait('@getRules')
      cy.wait('@validateRules')
      
      cy.contains('Valid YAML').should('be.visible')
    })

    it('shows Save button when there are changes', () => {
      cy.wait('@getRules')
      
      // Type something in the editor
      cy.get('.monaco-editor textarea').first().type('# comment', { force: true })
      
      cy.contains('Unsaved changes').should('be.visible')
    })

    it('can save rules', () => {
      cy.wait('@getRules')
      
      // Make a change
      cy.get('.monaco-editor textarea').first().type('# comment', { force: true })
      
      // Wait for validation
      cy.wait('@validateRules')
      
      // Save
      cy.contains('button', 'Save Rules').click()
      cy.wait('@saveRules')
    })
  })

  describe('Rule Testing', () => {
    it('can test a message against rules', () => {
      cy.wait('@getRules')
      cy.wait('@getChats')
      
      // Fill in test form
      cy.get('select').first().select('31612345678@s.whatsapp.net')
      cy.get('input[placeholder*="31612345678"]').type('31612345678')
      cy.get('input[placeholder*="goodnight"]').type('goodnight')
      
      cy.contains('button', 'Run Test').click()
      cy.wait('@testRules')
      
      // Should show matched rules
      cy.contains('Matched Rules').should('be.visible')
      cy.contains('Goodnight Routine').should('be.visible')
    })

    it('shows no match when text does not match', () => {
      cy.wait('@getRules')
      cy.wait('@getChats')
      
      cy.intercept('POST', '/api/rules/test', {
        statusCode: 200,
        body: {
          matched_rules: [],
          actions_preview: [],
        },
      }).as('testRulesNoMatch')
      
      cy.get('input[placeholder*="goodnight"]').type('hello world')
      cy.contains('button', 'Run Test').click()
      
      cy.wait('@testRulesNoMatch')
      cy.contains('No rules matched').should('be.visible')
    })
  })

  describe('Guided Builder', () => {
    beforeEach(() => {
      cy.wait('@getRules')
      cy.contains('button', 'Guided Builder').click()
    })

    it('switches to guided builder view', () => {
      cy.contains('Basic Info').should('be.visible')
      cy.contains('Match Conditions').should('be.visible')
      cy.contains('Actions').should('be.visible')
    })

    it('can fill in rule details', () => {
      // Basic info
      cy.get('input[placeholder*="goodnight_routine"]').type('morning_routine')
      cy.get('input[placeholder*="Goodnight Routine"]').type('Morning Routine')
      
      // Match conditions
      cy.get('select').first().select('direct')
      cy.get('input[placeholder*="keyword"]').type('good morning{enter}')
      
      // Should show the keyword
      cy.contains('good morning').should('be.visible')
    })

    it('can add HA Service action', () => {
      cy.contains('button', 'Call HA Script').click()
      
      // Should show action form
      cy.contains('HA Service').should('be.visible')
    })

    it('can add WhatsApp Reply action', () => {
      cy.contains('button', 'WhatsApp Reply').click()
      
      // Should show reply input
      cy.get('input[placeholder*="Reply message"]').should('be.visible')
    })

    it('shows YAML preview', () => {
      // Fill in minimal info
      cy.get('input[placeholder*="goodnight_routine"]').type('test_rule')
      cy.get('input[placeholder*="Goodnight Routine"]').type('Test Rule')
      
      // Preview should update
      cy.contains('YAML Preview').should('be.visible')
      cy.get('pre').should('contain', 'test_rule')
      cy.get('pre').should('contain', 'Test Rule')
    })

    it('can add rule to YAML', () => {
      // Fill in required fields
      cy.get('input[placeholder*="goodnight_routine"]').type('test_rule')
      cy.get('input[placeholder*="Goodnight Routine"]').type('Test Rule')
      
      // Add an action
      cy.contains('button', 'WhatsApp Reply').click()
      cy.get('input[placeholder*="Reply message"]').type('Hello!')
      
      // Add rule
      cy.contains('button', 'Add Rule to YAML').click()
      
      // Should switch to YAML view
      cy.contains('YAML Editor').should('have.class', 'bg-wa-dark')
    })
  })

  describe('Validation errors', () => {
    it('shows validation errors for invalid YAML', () => {
      cy.wait('@getRules')
      
      // Mock invalid response
      cy.intercept('POST', '/api/rules/validate', {
        statusCode: 200,
        body: {
          valid: false,
          errors: [{ path: '/rules/0/id', message: 'Required field missing' }],
          rule_count: 0,
        },
      }).as('validateInvalid')
      
      // Make YAML invalid
      cy.get('.monaco-editor textarea').first().clear({ force: true })
      cy.get('.monaco-editor textarea').first().type('invalid: yaml', { force: true })
      
      cy.wait('@validateInvalid')
      
      cy.contains('error').should('be.visible')
    })
  })
})
