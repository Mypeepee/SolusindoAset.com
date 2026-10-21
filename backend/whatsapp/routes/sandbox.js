import { Router, json } from 'express';
import { randomUUID } from 'node:crypto';
import { secretsEqual } from '../lib/security.js';
import { ServiceError } from '../lib/http.js';
import { generatePropertyReply } from '../services/property_reply.js';
import { MemoryStore } from '../state/memory_store.js';
import { historyPolicy, IDLE_TIMEOUT_MS } from '../services/interaction_policy.js';
import { detectClosingIntent } from '../services/closing_state.js';
import { MouDocumentClient, shouldSendMouDocument, MOU_CAPTION, validatePdf } from '../services/mou_document.js';

const validRequestId = (id) => typeof id === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id);
function limited(code, status, retryAfter) { const error = new ServiceError(code, status); error.retryAfter = Math.max(1, Math.ceil(retryAfter)); return error; }

// Bounded server-owned conversations keep reset history and human pauses from
// being accidentally restored by stale history sent by the browser.
export function createSandboxRouter({ config, catalog, ai, documents = config.mouDocument ? new MouDocumentClient(config.mouDocument) : null, now = Date.now, timeoutMs = 105000 }) {
  const router = Router(), activity = new Map(), cancelledRequests = new Map();
  const files = new Map(); let fileBytes = 0;
  const removeFile = (id) => { const entry = files.get(id); if (entry) fileBytes -= entry.file.buffer.length; files.delete(id); };
  const trimFiles = () => { for (const [id, entry] of files) if (entry.expires <= now()) removeFile(id); };
  const sessions = new MemoryStore({ ...config, maxSessions: 1000, sessionTtlMs: 86400000 }, now);
  let pending = 0;
  router.use((req, res, next) => {
    const header = req.get('Authorization');
    if (!header?.startsWith('Bearer ') || !secretsEqual(header.slice(7), config.adminToken)) return res.sendStatus(401);
    next();
  });
  router.use(json({ limit: '48kb' }));
  router.get('/:agentId/documents/:documentId', (req, res) => {
    trimFiles();
    const entry = files.get(req.params.documentId);
    if (!entry || entry.agentId !== req.params.agentId) throw new ServiceError('DOCUMENT_NOT_FOUND', 404);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${entry.file.filename}"` });
    res.send(entry.file.buffer);
  });
  router.delete('/:agentId/messages/:requestId', (req, res) => {
    if (!/^AG\d{1,18}$/.test(req.params.agentId) || !validRequestId(req.params.requestId)) throw new ServiceError('INVALID_REQUEST', 400);
    const active = activity.get(req.params.agentId)?.active;
    if (active?.id === req.params.requestId) active.controller.abort(new ServiceError('REQUEST_CANCELLED', 499));
    // A reset can arrive while Next.js is still authenticating the original
    // POST. Remember its ID briefly so that a late POST never starts the model.
    for (const [key, until] of cancelledRequests) if (until <= now()) cancelledRequests.delete(key);
    if (cancelledRequests.size >= 5000) cancelledRequests.delete(cancelledRequests.keys().next().value);
    cancelledRequests.set(`${req.params.agentId}:${req.params.requestId}`, now() + 70000);
    res.status(204).end();
  });
  router.post('/:agentId/messages', async (req, res) => {
    const { agentId } = req.params, { history, previousId, requestId, conversationId } = req.body || {};
    if (!/^AG\d{1,18}$/.test(agentId) || !Array.isArray(history) || !history.length || history.length > 20 ||
      history.some((m) => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 4000) ||
      history.reduce((n, m) => n + m.content.length, 0) > 24000 || history.at(-1).role !== 'user' ||
      (previousId != null && (typeof previousId !== 'string' || !/^[1-9]\d{0,17}$/.test(previousId))) ||
      (requestId != null && !validRequestId(requestId)) || (conversationId != null && !validRequestId(conversationId))) throw new ServiceError('INVALID_REQUEST', 400);
    if (requestId && (cancelledRequests.get(`${agentId}:${requestId}`) || 0) > now()) throw new ServiceError('REQUEST_CANCELLED', 499);
    for (const [id, state] of activity) if (!state.active && state.until <= now()) activity.delete(id);
    const state = activity.get(agentId) || { count: 0, active: null, until: now() + 5 * 60000 };
    if (state.active) throw limited('SANDBOX_BUSY', 409, 1);
    if (state.count >= 30) throw limited('SANDBOX_RATE_LIMIT', 429, (state.until - now()) / 1000);
    if (pending >= 10 || (!activity.has(agentId) && activity.size >= 500)) throw limited('SANDBOX_CAPACITY', 503, 2);
    const controller = new AbortController(), active = { id: requestId || randomUUID(), controller };
    activity.set(agentId, state); state.count += 1; state.active = active; pending += 1;
    let released = false;
    const release = () => { if (released) return; released = true; if (state.active === active) state.active = null; pending -= 1; };
    controller.signal.addEventListener('abort', release, { once: true });
    const disconnect = () => { if (!res.writableEnded) controller.abort(new ServiceError('REQUEST_CANCELLED', 499)); };
    res.once('close', disconnect);
    const timer = setTimeout(() => controller.abort(new ServiceError('SANDBOX_TIMEOUT', 504)), timeoutMs); timer.unref();
    let abortListener;
    const cancelled = new Promise((_, reject) => {
      abortListener = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', abortListener, { once: true });
    });
    try {
      const text = history.at(-1).content;
      sessions.cleanup();
      const sessionKey = conversationId ? `${agentId}:${conversationId}` : null;
      if (sessionKey && !sessions.get(sessionKey) && sessions.sessions.size >= 1000) throw limited('SANDBOX_CAPACITY', 503, 2);
      const existing = sessionKey ? sessions.get(sessionKey) : null;
      const stored = sessionKey ? existing || sessions.create(sessionKey) : null;
      // After a backend restart the browser may still hold its selected ID.
      // Accept only that pointer for a new session; the catalog revalidates it.
      // Existing sessions, idle resets and human pauses keep server ownership.
      if (stored && !existing && previousId && !detectClosingIntent(text, { selectedAssetId: previousId })) stored.asset_id = previousId;
      const scope = stored ? { ...stored, history: [...stored.history] } : { ...historyPolicy(history), asset_id: previousId || null };
      if (stored) sessions.resetIfIdle(scope);
      scope.last_user_received_at = now(); scope.updated_at = now();
      if (stored) sessions.append(scope, 'user', text);
      const activeHistory = (stored ? scope.history : history).filter((item) => !item.property_ignored);
      const generate = async () => {
        const result = await generatePropertyReply({ catalog, ai, text, signal: controller.signal,
          history: activeHistory.map(({ role, content, seq }) => ({ role, content, ...(seq != null ? { seq } : {}) })), previousId: scope.asset_id,
          policyState: scope, now: now() });
        if (stored && documents && shouldSendMouDocument({ asset: result.asset, conversion: result.conversion, history: activeHistory, text, selectedAssetId: scope.asset_id })) {
          try {
            const file = validatePdf(await documents.generate(result.asset.id, result.conversion.max_bid || null, { signal: controller.signal }));
            if (file.assetId !== result.asset.id) throw new ServiceError('MOU_ASSET_MISMATCH', 502);
            if (controller.signal.aborted) throw controller.signal.reason;
            trimFiles();
            while (files.size >= 100 || fileBytes + file.buffer.length > 20 * 1024 * 1024) removeFile(files.keys().next().value);
            const id = randomUUID();
            files.set(id, { agentId, file, expires: now() + 15 * 60000 }); fileBytes += file.buffer.length;
            result.attachments = [{ id, filename: file.filename, asset_id: file.assetId, mime_type: 'application/pdf', bytes: file.buffer.length, caption: MOU_CAPTION }];
            result.conversion = { ...result.conversion, draft_document: { asset_id: file.assetId, status: 'preview', at: now(), filename: file.filename } };
          } catch {
            if (controller.signal.aborted) throw controller.signal.reason;
            result.document_error = 'MOU_PDF_UNAVAILABLE';
          }
        }
        return result;
      };
      const result = await Promise.race([generate(), cancelled]);
      if (!res.destroyed && !controller.signal.aborted) {
        if (result.suppressed && stored) scope.history.at(-1).property_ignored = true;
        if (result.action === 'handoff') { scope.is_bot_active = false; result.knowledge = { status: 'handover_simulated', source: 'sandbox' }; }
        if (result.knowledge.status === 'context_required') scope.out_of_scope_notified = true;
        else if (!result.suppressed && result.action !== 'handoff') {
          scope.out_of_scope_notified = false; scope.asset_id = result.asset?.id || null;
        }
        if (stored) {
          if (result.consultation) scope.consultation = result.consultation;
          if ('survey_state' in result) scope.survey_state = result.survey_state;
          if (result.conversion) scope.conversion = result.conversion;
          if (result.buyer_state) scope.buyer_state = result.buyer_state;
          if (result.reply) for (const reply of result.replies || [result.reply]) sessions.append(scope, 'assistant', reply);
          if (result.attachments?.length) sessions.append(scope, 'assistant', `[PDF ${result.attachments[0].filename}] ${MOU_CAPTION}`);
          Object.assign(stored, scope);
        }
        res.json({ reply: result.reply, ...(result.replies ? { replies: result.replies } : {}), suppressed: !!result.suppressed, asset: result.asset, knowledge: result.knowledge,
          session: { asset_id: scope.asset_id, is_bot_active: scope.is_bot_active !== false,
            conversion: scope.conversion || { mode: 'Search_State' }, idle_timeout_ms: config.sessionIdleMs || IDLE_TIMEOUT_MS },
          ...(result.attachments ? { attachments: result.attachments } : {}), ...(result.document_error ? { document_error: result.document_error } : {}),
          generation: result.generation || { mode: 'rules' } });
      }
    } catch (error) {
      if (!res.destroyed) throw controller.signal.aborted ? controller.signal.reason : error;
    } finally {
      clearTimeout(timer); res.off('close', disconnect);
      controller.signal.removeEventListener('abort', abortListener);
      controller.signal.removeEventListener('abort', release); release();
    }
  });
  return router;
}
