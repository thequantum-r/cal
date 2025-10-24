import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'

export async function GET(request, { params }) {
  try {
    const { statementId } = params
    const supabase = await createClient()

    // Get the statement with all related data
    const { data: statement, error: statementError } = await supabase
      .from('shareholder_statements')
      .select(`
        *,
        shareholders(*),
        issuers_new(issuer_name),
        statement_details(*),
        statement_transactions(*)
      `)
      .eq('id', statementId)
      .single()

    if (statementError || !statement) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 })
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    })

    // Set response headers for PDF download
    const response = new NextResponse()
    response.headers.set('Content-Type', 'application/pdf')
    response.headers.set('Content-Disposition', `attachment; filename="statement-${statement.statement_number}.pdf"`)

    // Pipe PDF to response
    doc.pipe(response)

    // Add header
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text(`${statement.issuers.display_name} Shareholder Statement`, { align: 'center' })
      .fontSize(14)
      .text(`As of ${new Date(statement.statement_date).toLocaleDateString()}`, { align: 'center' })

    doc.moveDown(2)

    // Add shareholder information
    doc.fontSize(12)
      .font('Helvetica-Bold')
      .text('Shareholder Information:')
      .font('Helvetica')
      .fontSize(10)
      .text(`Name: ${statement.shareholders.last_name}, ${statement.shareholders.first_name}`)
      .text(`Account #: ${statement.shareholders.account_number}`)
      .text(`TIN: ${statement.shareholders.tax_id || 'Not Available'}`)
      .text(`Email: ${statement.shareholders.email || ''}`)

    doc.moveDown(2)

    // Add security holdings table
    doc.fontSize(12)
      .font('Helvetica-Bold')
      .text('Security Holdings:')
      .moveDown(0.5)

    // Table headers
    const tableTop = doc.y
    const tableLeft = 50
    const colWidths = [200, 100, 100, 100]
    const headers = ['SECURITY TYPE', 'Shares Outstanding', 'Market Value', 'Restrictions*']

    // Draw table headers
    doc.font('Helvetica-Bold')
      .fontSize(9)
    let currentX = tableLeft
    headers.forEach((header, i) => {
      doc.text(header, currentX, tableTop)
      currentX += colWidths[i]
    })

    // Draw table rows
    let currentY = tableTop + 20
    doc.font('Helvetica')
      .fontSize(9)

    statement.statement_details.forEach((detail) => {
      if (currentY > 700) {
        doc.addPage()
        currentY = 50
      }

      currentX = tableLeft
      
      // Security type column
      doc.text(`${statement.issuers.display_name}`, currentX, currentY)
      doc.text(`${detail.security_type || 'Class B Ordinary Shares'}`, currentX, currentY + 12)
      doc.text(`CUSIP: ${detail.cusip}`, currentX, currentY + 24)
      currentX += colWidths[0]

      // Shares outstanding
      doc.text(detail.shares_outstanding.toLocaleString(), currentX, currentY, { width: colWidths[1] })
      currentX += colWidths[1]

      // Market value
      const marketValue = detail.market_value_total || 0
      doc.text(marketValue > 0 ? `$${marketValue.toFixed(2)}` : 'TBD', currentX, currentY, { width: colWidths[2] })
      currentX += colWidths[2]

      // Restrictions
      doc.text(detail.restrictions_text.includes('No restrictions') ? '' : 'Restricted', currentX, currentY, { width: colWidths[3] })

      currentY += 40
    })

    doc.moveDown(2)

    // Add recent transactions table
    if (statement.statement_transactions && statement.statement_transactions.length > 0) {
      doc.fontSize(12)
        .font('Helvetica-Bold')
        .text('Recent Transactions:')
        .moveDown(0.5)

      const transactionTableTop = doc.y
      const transactionHeaders = ['Transaction', 'Transaction Date', '# of Shares', 'Price Per Share']
      const transactionColWidths = [150, 100, 100, 100]

      // Draw transaction table headers
      doc.font('Helvetica-Bold')
        .fontSize(9)
      currentX = tableLeft
      transactionHeaders.forEach((header, i) => {
        doc.text(header, currentX, transactionTableTop)
        currentX += transactionColWidths[i]
      })

      // Draw transaction table rows
      currentY = transactionTableTop + 20
      doc.font('Helvetica')
        .fontSize(9)

      statement.statement_transactions.slice(0, 5).forEach((transaction) => {
        if (currentY > 700) {
          doc.addPage()
          currentY = 50
        }

        currentX = tableLeft
        
        doc.text(transaction.transaction_type, currentX, currentY, { width: transactionColWidths[0] })
        currentX += transactionColWidths[0]

        doc.text(new Date(transaction.transaction_date).toLocaleDateString(), currentX, currentY, { width: transactionColWidths[1] })
        currentX += transactionColWidths[1]

        doc.text(transaction.shares_quantity.toLocaleString(), currentX, currentY, { width: transactionColWidths[2] })
        currentX += transactionColWidths[2]

        const price = transaction.price_per_share || 0
        doc.text(price > 0 ? `$${price.toFixed(2)}` : '$10.00', currentX, currentY, { width: transactionColWidths[3] })

        currentY += 20
      })
    }

    doc.moveDown(2)

    // Add restrictions section
    doc.fontSize(12)
      .font('Helvetica-Bold')
      .text('*Restrictions:')
      .moveDown(0.5)

    doc.font('Helvetica')
      .fontSize(10)

    statement.statement_details.forEach((detail) => {
      if (detail.restrictions_text && !detail.restrictions_text.includes('No restrictions')) {
        doc.text(detail.restrictions_text)
        doc.moveDown(0.5)
      }
    })

    // Add footer
    doc.moveDown(3)
    doc.fontSize(10)
      .font('Helvetica')
      .text('If you have any questions, please do not hesitate to reach out to us at DAAQ@useefficiency.com', { align: 'center' })

    // Finalize PDF
    doc.end()

    return response

  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}






