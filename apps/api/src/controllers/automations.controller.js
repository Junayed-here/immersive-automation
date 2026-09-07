import * as automationsRepo from '../repositories/automations.repo.js';
import * as automationRunsRepo from '../repositories/automationRuns.repo.js';
import * as deliveriesRepo from '../repositories/deliveries.repo.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ok, fail } from '../utils/respond.js';
import { runAutomation } from '../services/automation/runner.js';
import { scheduleAutomation, unscheduleAutomation } from '../jobs/scheduler.js';

export const listAutomations = asyncHandler(async function listAutomations(req, res) {
  const { page = 1, limit = 20 } = req.query;
  const { automations, total } = await automationsRepo.list({ realtorId: req.realtorId, page, limit });
  return ok(res, 200, { automations, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } });
});

export const createAutomation = asyncHandler(async function createAutomation(req, res) {
  const automation = await automationsRepo.create({ ...req.body, realtorId: req.realtorId });
  await scheduleAutomation(automation);
  return ok(res, 201, { automation }, 'Automation created.');
});

export const getAutomation = asyncHandler(async function getAutomation(req, res) {
  const automation = await automationsRepo.findById(req.realtorId, req.params.id);
  if (!automation) return fail(res, 404, 'Automation not found.');
  return ok(res, 200, { automation });
});

export const updateAutomation = asyncHandler(async function updateAutomation(req, res) {
  const automation = await automationsRepo.update(req.realtorId, req.params.id, req.body);
  if (!automation) return fail(res, 404, 'Automation not found.');

  await scheduleAutomation(automation);
  return ok(res, 200, { automation }, 'Automation updated.');
});

export const deleteAutomation = asyncHandler(async function deleteAutomation(req, res) {
  const automation = await automationsRepo.remove(req.realtorId, req.params.id);
  if (!automation) return fail(res, 404, 'Automation not found.');
  unscheduleAutomation(automation._id);
  return ok(res, 200, { automation }, 'Automation deleted.');
});

export const previewAutomation = asyncHandler(async function previewAutomation(req, res) {
  const automation = await automationsRepo.findById(req.realtorId, req.params.id);
  if (!automation) return fail(res, 404, 'Automation not found.');
  const run = await runAutomation(automation._id, { trigger: 'preview', dryRun: true });
  return ok(res, 200, { run }, 'Preview complete.');
});

export const runAutomationNow = asyncHandler(async function runAutomationNow(req, res) {
  const automation = await automationsRepo.findById(req.realtorId, req.params.id);
  if (!automation) return fail(res, 404, 'Automation not found.');
  const run = await runAutomation(automation._id, { trigger: 'manual', dryRun: false });
  return ok(res, 200, { run }, 'Run complete.');
});

export const listRunsForRealtor = asyncHandler(async function listRunsForRealtor(req, res) {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const runs = await automationRunsRepo.findByRealtorId(req.realtorId, limit);
  return ok(res, 200, { runs });
});

export const listRunsForAutomation = asyncHandler(async function listRunsForAutomation(req, res) {
  const automation = await automationsRepo.findById(req.realtorId, req.params.id);
  if (!automation) return fail(res, 404, 'Automation not found.');
  const runs = await automationRunsRepo.findByAutomationId(automation._id);
  return ok(res, 200, { runs });
});

export const getRun = asyncHandler(async function getRun(req, res) {
  const run = await automationRunsRepo.findById(req.realtorId, req.params.runId);
  if (!run) return fail(res, 404, 'Run not found.');
  const deliveries = await deliveriesRepo.findByRunId(run._id);
  return ok(res, 200, { run, deliveries });
});
