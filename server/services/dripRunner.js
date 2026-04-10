const supabase = require('../db');
const { wrapWithDesignTemplate, wrapWithDesignTemplateById } = require('./emailWrapper');

async function runDripSequences() {
  console.log('💧 Drip Runner — Starting...');

  const { data: sequences } = await supabase
    .from('crm_drip_sequences')
    .select('*')
    .eq('active', true);

  if (!sequences?.length) {
    console.log('💧 Drip Runner — No active sequences');
    return;
  }

  for (const seq of sequences) {
    const { data: steps } = await supabase
      .from('crm_drip_steps')
      .select('*')
      .eq('sequence_id', seq.id)
      .eq('active', true)
      .order('step_number', { ascending: true });

    if (!steps?.length) continue;

    const { data: enrollments } = await supabase
      .from('crm_drip_enrollments')
      .select('*')
      .eq('sequence_id', seq.id)
      .eq('completed', false);

    if (!enrollments?.length) continue;

    for (const enrollment of enrollments) {
      const { data: sends } = await supabase
        .from('crm_drip_sends')
        .select('step_id')
        .eq('enrollment_id', enrollment.id);

      const sentStepIds = new Set((sends || []).map(s => s.step_id));

      for (const step of steps) {
        if (sentStepIds.has(step.id)) continue;

        const enrolledAt = new Date(enrollment.enrolled_at);
        const sendAfter = new Date(enrolledAt.getTime() + step.delay_days * 24 * 60 * 60 * 1000);

        if (new Date() < sendAfter) continue;

        // Send the email
        try {
          let html = (step.body_html || '')
            .replace(/{{first_name}}/g, enrollment.first_name || 'there')
            .replace(/{{email}}/g, enrollment.email);

          const unsubscribeUrl = `https://crm-api.planfor.io/api/waitlist/unsubscribe?email=${encodeURIComponent(enrollment.email)}`;

          if (step.design_template_id) {
            html = await wrapWithDesignTemplateById(html, step.design_template_id);
          } else {
            html = await wrapWithDesignTemplate(html, 'transactional');
          }

          html = html.replace('{{unsubscribe_url}}', unsubscribeUrl);

          const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

          const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${SENDGRID_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                personalizations: [{
                  to: [{ email: enrollment.email, name: enrollment.first_name || '' }],
                  custom_args: {
                    email_type: 'drip',
                    step_id: step.id,
                    sequence_id: seq.id,
                  },
                }],
                from: { email: 'noreply@planfor.io', name: 'Planfor' },
                reply_to: { email: 'hello@planfor.io', name: 'Planfor' },
                subject: step.subject,
                content: [{ type: 'text/html', value: html }],
                tracking_settings: {
                  click_tracking: { enable: true },
                  open_tracking: { enable: true },
                },
              }),
          });

          if (response.ok) {
            const messageId = response.headers.get('x-message-id') || null;
            await supabase.from('crm_drip_sends').insert([{
              enrollment_id: enrollment.id,
              step_id: step.id,
              status: 'sent',
              email: enrollment.email,
              sendgrid_message_id: messageId,
            }]);
            console.log(`💧 Sent step ${step.step_number} to ${enrollment.email} — msg: ${messageId}`);
          }
        } catch (err) {
          console.error(`💧 Failed to send step ${step.step_number} to ${enrollment.email}:`, err.message);
        }

        break; // Only send one step per enrollment per run
      }

      // Check if all steps are done
      const { data: updatedSends } = await supabase
        .from('crm_drip_sends')
        .select('step_id')
        .eq('enrollment_id', enrollment.id);

      if (updatedSends?.length >= steps.length) {
        await supabase
          .from('crm_drip_enrollments')
          .update({ completed: true })
          .eq('id', enrollment.id);
      }
    }
  }

  console.log('💧 Drip Runner — Complete');
}

module.exports = { runDripSequences };