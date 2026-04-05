const supabase = require('../db');

async function wrapWithDesignTemplate(bodyHtml, type) {
  try {
    const { data: template } = await supabase
      .from('crm_email_design_templates')
      .select('*')
      .eq('type', type)
      .eq('active', true)
      .single();

    if (!template) return bodyHtml;

    // If wrapper_html exists use it with {{content}} placeholder
    if (template.wrapper_html && template.wrapper_html.includes('{{content}}')) {
      return template.wrapper_html.replace('{{content}}', bodyHtml);
    }

    // Otherwise combine header + body + footer
    const header = template.header_html || '';
    const footer = template.footer_html || '';
    return `${header}${bodyHtml}${footer}`;
  } catch (err) {
    console.error('emailWrapper error:', err.message);
    return bodyHtml;
  }
}

async function wrapWithDesignTemplateById(bodyHtml, templateId) {
  try {
    const { data: template } = await supabase
      .from('crm_email_design_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (!template) return bodyHtml;

    if (template.wrapper_html && template.wrapper_html.includes('{{content}}')) {
      return template.wrapper_html.replace('{{content}}', bodyHtml);
    }

    const header = template.header_html || '';
    const footer = template.footer_html || '';
    return `${header}${bodyHtml}${footer}`;
  } catch (err) {
    console.error('emailWrapper error:', err.message);
    return bodyHtml;
  }
}

module.exports = { wrapWithDesignTemplate, wrapWithDesignTemplateById };