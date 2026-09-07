import * as deliveriesRepo from '../repositories/deliveries.repo.js';
import * as realtorsRepo from '../repositories/realtors.repo.js';
import { sendMail } from '../services/email/transport.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ok, fail } from '../utils/respond.js';

export const getDeliveryHtml = asyncHandler(async function getDeliveryHtml(req, res) {
  const delivery = await deliveriesRepo.findById(req.realtorId, req.params.id);
  if (!delivery) return fail(res, 404, 'Delivery not found.');
  return ok(res, 200, { subject: delivery.subject, html: delivery.renderedHtml });
});

// A failed delivery already has its rendered subject/html stored from the
// original run - retry re-attempts the same send rather than re-rendering,
// since the underlying buyer/listing data hasn't changed.
export const retryDelivery = asyncHandler(async function retryDelivery(req, res) {
  const delivery = await deliveriesRepo.findByIdWithBuyer(req.realtorId, req.params.id);
  if (!delivery) return fail(res, 404, 'Delivery not found.');
  if (delivery.status !== 'failed') return fail(res, 400, 'Only a failed delivery can be retried.');
  if (!delivery.renderedHtml || !delivery.buyerId) return fail(res, 400, 'This delivery has nothing to resend.');

  const realtor = await realtorsRepo.findById(req.realtorId);

  let updated;
  try {
    const info = await sendMail({
      to: delivery.buyerId.email,
      subject: delivery.subject,
      html: delivery.renderedHtml,
      replyTo: realtor.emailSettings?.replyTo || realtor.email,
    });
    updated = await deliveriesRepo.update(delivery._id, {
      status: 'sent',
      providerMessageId: info.messageId,
      sentAt: new Date(),
      error: { message: null },
    });
  } catch (err) {
    updated = await deliveriesRepo.update(delivery._id, { error: { message: err.message } });
  }

  return ok(res, 200, { delivery: updated }, updated.status === 'sent' ? 'Resent.' : 'Retry failed.');
});

// Sends the already-rendered content of a delivery to an arbitrary address
// without touching that delivery's own status - used for the wizard's "send
// test to myself" and doesn't count as a real send to that buyer.
export const sendTestEmail = asyncHandler(async function sendTestEmail(req, res) {
  const delivery = await deliveriesRepo.findById(req.realtorId, req.params.id);
  if (!delivery) return fail(res, 404, 'Delivery not found.');
  if (!delivery.renderedHtml) return fail(res, 400, 'This delivery has no rendered email to send.');

  const realtor = await realtorsRepo.findById(req.realtorId);

  await sendMail({
    to: req.body.to,
    subject: `[Test] ${delivery.subject}`,
    html: delivery.renderedHtml,
    replyTo: realtor.emailSettings?.replyTo || realtor.email,
  });

  return ok(res, 200, null, `Test email sent to ${req.body.to}.`);
});
