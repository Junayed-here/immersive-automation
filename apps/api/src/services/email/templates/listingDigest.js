/**
 * Hand-rolled table-based HTML (master-plan §8 explicitly allows this instead
 * of MJML) - no flexbox/grid anywhere, Outlook renders tables reliably.
 */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));
}

function formatPrice(price) {
  return `$${Number(price).toLocaleString('en-US')}`;
}

function renderTemplate(template, vars) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => (key in vars ? String(vars[key]) : ''));
}

const HOME_TYPE_LABELS = {
  SINGLE_FAMILY: 'Single-family',
  CONDO: 'Condo',
  MULTI_FAMILY: 'Multi-family',
  TOWNHOUSE: 'Townhouse',
  LOT: 'Lot / Land',
  MANUFACTURED: 'Manufactured',
};

function listingCardHtml(listing, accentColor, ctaLabel) {
  const photo = listing.photos?.[0];
  const details = [
    `${listing.bedrooms ?? '?'} bd`,
    `${listing.bathrooms ?? '?'} ba`,
    listing.sqft ? `${listing.sqft.toLocaleString('en-US')} sqft` : null,
    listing.lotSize ? `${listing.lotSize.toLocaleString('en-US')} sqft lot` : null,
    listing.yearBuilt ? `built ${listing.yearBuilt}` : null,
    escapeHtml(HOME_TYPE_LABELS[listing.propertyType] || listing.propertyType || '') || null,
  ]
    .filter(Boolean)
    .join(' &middot; ');

  return `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #e5e7eb;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="140" style="vertical-align:top;">
              ${photo ? `<img src="${escapeHtml(photo)}" width="120" height="90" alt="" style="display:block;border-radius:6px;object-fit:cover;" />` : ''}
            </td>
            <td style="vertical-align:top;padding-left:12px;font-family:Arial,sans-serif;color:#111827;">
              <div style="font-size:16px;font-weight:bold;">${escapeHtml(listing.address?.line1 || '')}</div>
              <div style="font-size:13px;color:#6b7280;">${escapeHtml(listing.address?.city || '')}, ${escapeHtml(listing.address?.state || '')} ${escapeHtml(listing.address?.zip || '')}</div>
              <div style="font-size:15px;color:#1f2937;margin-top:4px;">${formatPrice(listing.price)}</div>
              <div style="font-size:13px;color:#6b7280;margin-top:2px;">${details}</div>
              ${listing.description ? `<div style="font-size:13px;color:#374151;margin-top:6px;">${escapeHtml(listing.description)}</div>` : ''}
              <div style="margin-top:8px;">
                <a href="${escapeHtml(listing.listingUrl)}" style="display:inline-block;padding:8px 14px;background:${accentColor};color:#ffffff;text-decoration:none;border-radius:4px;font-size:13px;font-family:Arial,sans-serif;">${escapeHtml(ctaLabel)}</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/**
 * `client` is a Buyer document. The per-listing CTA links straight to
 * listing.listingUrl (the real Zillow page) - there's no in-app listing
 * page or conversation thread to route through anymore.
 */
export function renderListingEmail({ realtor, client, listings, automation, unsubscribeUrl }) {
  const template = automation.emailTemplate || {};
  // Admin-supplied, and interpolated unquoted into `style="background:...;"`
  // below - restrict to a real hex color rather than just HTML-escaping, so
  // it can't smuggle extra CSS declarations or break out of the attribute.
  const accentColor = /^#[0-9a-fA-F]{3,8}$/.test(template.theme?.accentColor || '') ? template.theme.accentColor : '#1a56db';
  const ctaLabel = template.ctaLabel || 'View on Zillow';
  const zip = client.preferences?.zipCodes?.[0] || '';
  const firstName = (client.name || '').split(' ')[0] || client.name || 'there';
  const realtorName = realtor.fullName || `${realtor.firstName} ${realtor.lastName}`;

  const vars = { firstName, zip, listingCount: listings.length, realtorName };

  const subject = renderTemplate(template.subject || 'New listings in {{zip}} for you, {{firstName}}', vars);
  const introHtml = template.introHtml
    ? renderTemplate(template.introHtml, vars)
    : `Hi ${escapeHtml(firstName)}, here are ${listings.length} new listing${listings.length === 1 ? '' : 's'} in ${escapeHtml(zip)} matching your search.`;

  const cards = listings.map((listing) => listingCardHtml(listing, accentColor, ctaLabel)).join('');
  const licenseLine = realtor.license?.number ? ` &middot; License #${escapeHtml(realtor.license.number)}` : '';
  const brokerageAddress = realtor.brokerage?.address ? ` &middot; ${escapeHtml(realtor.brokerage.address)}` : '';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:${accentColor};padding:20px 24px;font-family:Arial,sans-serif;color:#ffffff;">
            <div style="font-size:18px;font-weight:bold;">${escapeHtml(realtorName)}</div>
            <div style="font-size:13px;opacity:0.9;">${escapeHtml(realtor.brokerage?.name || '')}${licenseLine}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px;font-family:Arial,sans-serif;color:#111827;font-size:14px;">${introHtml}</td>
        </tr>
        <tr>
          <td style="padding:0 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cards}</table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px;font-family:Arial,sans-serif;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;">
            ${escapeHtml(realtorName)}${brokerageAddress}<br />
            <a href="${escapeHtml(unsubscribeUrl || '#')}" style="color:#6b7280;">Unsubscribe</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject, html };
}
