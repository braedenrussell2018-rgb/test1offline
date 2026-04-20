// Shared print/PDF HTML renderer for quotes and invoices
// Used by InvoiceQuoteEditor and any other component that needs to print docs.

export interface PrintLineItem {
  partNumber: string;
  serialNumber?: string;
  description: string;
  price: number;
  quantity?: number;
}

export interface PrintDocumentData {
  type: 'quote' | 'invoice';
  number: string;
  isDraft?: boolean;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shipToAddress?: string;
  salesmanName?: string;
  items: PrintLineItem[];
  subtotal: number;
  discount: number;
  shippingCost: number;
  tax: number;
  total: number;
  notes?: string;
}

const escapeHtml = (s: string | undefined): string => {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export function printDocument(doc: PrintDocumentData) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const isInvoice = doc.type === 'invoice';
  const titleLabel = isInvoice
    ? `INVOICE${doc.isDraft ? ' (DRAFT)' : ''}`
    : 'QUOTE';

  const itemsHtml = doc.items
    .map((item) => {
      const qty = item.quantity || 1;
      const lineTotal = qty * item.price;
      return `
        <tr>
          <td>${escapeHtml(item.partNumber)}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${escapeHtml(item.serialNumber) || '—'}</td>
          <td class="num">${qty}</td>
          <td class="num">$${item.price.toFixed(2)}</td>
          <td class="num">$${lineTotal.toFixed(2)}</td>
        </tr>
      `;
    })
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${titleLabel} ${escapeHtml(doc.number)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          .doc-header { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .doc-title { font-size: 28px; font-weight: bold; color: #2563eb; }
          .doc-meta { font-size: 12px; color: #666; margin-top: 5px; }
          .section { margin-bottom: 25px; }
          .section-title { font-weight: bold; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; color: #666; }
          .customer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
          .customer-info p { font-size: 13px; margin: 3px 0; }
          .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .items-table th { text-align: left; font-size: 11px; color: #666; padding: 8px 4px; border-bottom: 2px solid #e5e5e5; }
          .items-table td { padding: 10px 4px; border-bottom: 1px solid #e5e5e5; font-size: 13px; vertical-align: top; }
          .items-table .num { text-align: right; }
          .totals { margin-top: 20px; margin-left: auto; width: 280px; }
          .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
          .totals-row.total { border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; font-size: 16px; font-weight: bold; }
          .notes { margin-top: 30px; padding: 15px; background: #f8f9fa; border-left: 3px solid #2563eb; font-size: 12px; white-space: pre-wrap; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #666; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="doc-header">
          <div>
            <div class="doc-title">${titleLabel}</div>
            <div class="doc-meta">#${escapeHtml(doc.number)}</div>
            <div class="doc-meta">Date: ${new Date().toLocaleDateString()}</div>
          </div>
          ${doc.salesmanName ? `<div class="doc-meta">Salesman: ${escapeHtml(doc.salesmanName)}</div>` : ''}
        </div>

        <div class="customer-grid section">
          <div>
            <div class="section-title">Bill To</div>
            <div class="customer-info">
              <p><strong>${escapeHtml(doc.customerName) || '—'}</strong></p>
              ${doc.customerEmail ? `<p>${escapeHtml(doc.customerEmail)}</p>` : ''}
              ${doc.customerPhone ? `<p>${escapeHtml(doc.customerPhone)}</p>` : ''}
            </div>
          </div>
          <div>
            <div class="section-title">Ship To</div>
            <div class="customer-info">
              <p>${escapeHtml(doc.shipToAddress) || '—'}</p>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Items</div>
          <table class="items-table">
            <thead>
              <tr>
                <th style="width:15%">Part #</th>
                <th style="width:35%">Description</th>
                <th style="width:18%">Serial #</th>
                <th style="width:8%" class="num">Qty</th>
                <th style="width:12%" class="num">Unit Price</th>
                <th style="width:12%" class="num">Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>

        <div class="totals">
          <div class="totals-row">
            <span>Subtotal:</span>
            <span>$${doc.subtotal.toFixed(2)}</span>
          </div>
          ${doc.discount > 0 ? `
            <div class="totals-row">
              <span>Discount:</span>
              <span>-$${doc.discount.toFixed(2)}</span>
            </div>
          ` : ''}
          ${doc.shippingCost > 0 ? `
            <div class="totals-row">
              <span>Shipping:</span>
              <span>$${doc.shippingCost.toFixed(2)}</span>
            </div>
          ` : ''}
          ${doc.tax > 0 ? `
            <div class="totals-row">
              <span>Tax:</span>
              <span>$${doc.tax.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="totals-row total">
            <span>Total:</span>
            <span>$${doc.total.toFixed(2)}</span>
          </div>
        </div>

        ${doc.notes ? `
          <div class="notes">
            <strong>Notes:</strong><br/>${escapeHtml(doc.notes)}
          </div>
        ` : ''}

        ${!isInvoice ? `
          <div class="footer">
            This quote is valid for 30 days from the date of issue.
          </div>
        ` : ''}
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}
