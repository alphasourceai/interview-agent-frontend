export const playbookUrl = 'https://script.google.com/a/macros/alphasourceai.com/s/AKfycbwZOp_y26EYMeEoVrVlPXaab5CnJzY042TzmdypsquDRIpSJtfWle1sd-4OV6clCZ5P/exec?view=playbook';
export const onboardingUrl = playbookUrl.replace('?view=playbook', '');
export const salesDriveUrl = 'https://drive.google.com/drive/u/0/folders/0AKo1VUJgFSwoUk9PVA';
export const ghlUrl = 'https://app.spotonmediasolutions.com/v2/location/9AlpNONrH1wb0FtPKkbo/opportunities/list';
export const salesWonUrl = 'https://app.slack.com/archives/C0C2GPA9BNF';

export function homeCounts(deals, imports) {
  return {
    ready: imports.filter(i => i.status === 'ready' && !i.purchase_intent_id).length,
    open: deals.filter(i => ['agreement_sent', 'signed_payment_needed', 'checkout_in_progress', 'setup_in_progress'].includes(i.status)).length,
    payment: deals.filter(i => ['signed_payment_needed', 'checkout_in_progress'].includes(i.status)).length,
    won: deals.filter(i => i.status === 'activated').length,
    attention: deals.filter(i => ['needs_attention', 'expired'].includes(i.status)).length,
  };
}

export function formatBusinessPhone(value) {
  return /^\+1[2-9][0-9]{9}$/.test(value || '') ? `${value.slice(2, 5)}.${value.slice(5, 8)}.${value.slice(8)}` : '';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
}

export function salesSignature(rep) {
  const name = String(rep.display_name || '').trim();
  const email = String(rep.email || '').trim();
  const phone = formatBusinessPhone(rep.business_phone_e164);
  const text = [name, 'Independent Sales Representative | alphaSource', ...(phone ? [phone] : []), email, 'alphasourceai.com'].join('\n');
  // No arbitrary URL interpolation: only the validated business phone becomes a link.
  const phoneHtml = phone ? `<a href="tel:${escapeHtml(rep.business_phone_e164)}" style="color:#27304e;text-decoration:none">${phone}</a> | ` : '';
  const html = `<table role="presentation" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;color:#27304e;font-size:13px"><tr><td style="padding-right:18px;vertical-align:middle"><img src="https://www.alphasourceai.com/logo-dark-text-clear.png" width="150" alt="alphaSource" style="display:block;width:150px;height:auto"></td><td style="padding-left:18px;border-left:2px solid #02abe0;line-height:1.6"><strong style="font-size:15px">${escapeHtml(name)}</strong><br>Independent Sales Representative | alphaSource<br>${phoneHtml}<a href="https://www.alphasourceai.com" style="color:#27304e;text-decoration:none">alphasourceai.com</a><br>${escapeHtml(email)}</td></tr></table>`;
  return { text, html };
}
