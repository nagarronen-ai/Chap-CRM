// server/services/invoiceParser.js
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORIES = ['Server', 'Marketing', 'Domain', 'Software', 'Office', 'Travel', 'Legal', 'Accounting', 'HR', 'Other'];

async function parseInvoice(fileBuffer, mimeType) {
  try {
    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';

    if (!isImage && !isPdf) {
      throw new Error('Only images and PDFs are supported');
    }

    const base64 = fileBuffer.toString('base64');

    const prompt = `You are an invoice parser. Extract the following information from this invoice and return ONLY a JSON object with no markdown, no explanation, just raw JSON.

Extract:
- title: short description of what was purchased (e.g. "Render Hosting", "SendGrid Email Service")
- amount: numeric amount as a number (e.g. 29.99), no currency symbols
- date: date in YYYY-MM-DD format
- vendor: company/vendor name
- category: one of exactly these options: ${CATEGORIES.join(', ')}
- recurring: true if this appears to be a subscription or recurring payment, false otherwise
- recurring_interval: "monthly", "yearly", or "quarterly" — only if recurring is true, otherwise null
- notes: any relevant notes from the invoice (invoice number, plan name, etc.) — keep it short

Return only this JSON structure:
{
  "title": "...",
  "amount": 0.00,
  "date": "YYYY-MM-DD",
  "vendor": "...",
  "category": "...",
  "recurring": false,
  "recurring_interval": null,
  "notes": "..."
}`;

    const content = [];

    if (isImage) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: base64,
        },
      });
    } else {
      // PDF
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        },
      });
    }

    content.push({ type: 'text', text: prompt });

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 500,
      messages: [{ role: 'user', content }],
    });

    const text = response.content[0]?.text?.trim();
    if (!text) throw new Error('No response from Claude');

    // Strip markdown if present
    const clean = text.replace(/```json|```/g, '').trim();
    
    // Check if it looks like JSON before parsing
    if (!clean.startsWith('{')) {
        const err = new Error('NOT_AN_INVOICE');
        err.notAnInvoice = true;
        throw err;
      }
    
    const parsed = JSON.parse(clean);

    // Validate and sanitize
    return {
      title: parsed.title || '',
      amount: parseFloat(parsed.amount) || 0,
      date: parsed.date || new Date().toISOString().split('T')[0],
      vendor: parsed.vendor || '',
      category: CATEGORIES.includes(parsed.category) ? parsed.category : 'Other',
      recurring: !!parsed.recurring,
      recurring_interval: parsed.recurring_interval || (parsed.recurring ? 'monthly' : null),
      notes: parsed.notes || '',
    };

  } catch (err) {
    console.error('Invoice parser error:', err.message);
    throw err;
  }
}

module.exports = { parseInvoice };