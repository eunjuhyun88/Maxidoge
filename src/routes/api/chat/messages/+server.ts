import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { detectMentionedAgent, inferAgentFromIntent } from '$lib/chat/agentRouting';
import { buildAgentReply } from '$lib/server/chat/chatReplyService';
import {
  countChatMessages,
  getChatMessages,
  insertChatActivity,
  insertChatMessage,
  loadScanContext,
} from '$lib/server/chat/chatRepository';
import type { ChatMessageRecord } from '$lib/server/chat/chatTypes';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { toBoundedInt } from '$lib/server/apiValidation';
import { isRequestBodyTooLargeError, readJsonBody } from '$lib/server/requestGuards';
import { errorContains } from '$lib/utils/errorUtils';

const SENDER_KINDS = new Set(['user', 'agent', 'system']);

function buildEphemeralRow(input: {
  userId: string;
  channel: string;
  senderKind: string;
  senderId: string | null;
  senderName: string;
  message: string;
  meta: Record<string, unknown>;
}): ChatMessageRecord {
  return {
    id: `ephemeral-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    userId: input.userId,
    channel: input.channel,
    senderKind: input.senderKind,
    senderId: input.senderId,
    senderName: input.senderName,
    message: input.message,
    meta: input.meta,
    createdAt: Date.now(),
  };
}

function normalizeMeta(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' ? { ...(input as Record<string, unknown>) } : {};
}

export const GET: RequestHandler = async ({ cookies, url }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const limit = toBoundedInt(url.searchParams.get('limit'), 50, 1, 200);
    const offset = toBoundedInt(url.searchParams.get('offset'), 0, 0, 5000);
    const channel = typeof url.searchParams.get('channel') === 'string' ? url.searchParams.get('channel')!.trim() : '';

    const [total, records] = await Promise.all([
      countChatMessages(user.id, channel),
      getChatMessages(user.id, channel, limit, offset),
    ]);

    return json({
      success: true,
      total,
      records,
      pagination: { limit, offset },
    });
  } catch (error: unknown) {
    if (errorContains(error, 'DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[chat/messages/get] unexpected error:', error);
    return json({ error: 'Failed to load chat messages' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ cookies, request }) => {
  try {
    const body = await readJsonBody<Record<string, unknown>>(request, 32 * 1024);

    const channel = typeof body?.channel === 'string' ? body.channel.trim() : 'terminal';
    const senderKind = typeof body?.senderKind === 'string' ? body.senderKind.trim().toLowerCase() : 'user';
    const senderId = typeof body?.senderId === 'string' ? body.senderId.trim() : null;
    const senderName = typeof body?.senderName === 'string' ? body.senderName.trim() : 'YOU';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const meta = normalizeMeta(body?.meta);

    if (!message) return json({ error: 'message is required' }, { status: 400 });
    if (!SENDER_KINDS.has(senderKind)) return json({ error: 'senderKind must be user|agent|system' }, { status: 400 });
    if (channel.length > 64) return json({ error: 'channel is too long' }, { status: 400 });
    if (senderName.length > 64) return json({ error: 'senderName is too long' }, { status: 400 });
    if (message.length > 4000) return json({ error: 'message is too long' }, { status: 400 });

    let user: Awaited<ReturnType<typeof getAuthUserFromCookies>> | null = null;
    try {
      user = await getAuthUserFromCookies(cookies);
    } catch (authErr) {
      console.warn('[chat/messages/post] auth lookup failed, falling back to guest mode:', authErr);
      user = null;
    }

    const allowGuestTerminal = !user && channel === 'terminal' && senderKind === 'user';
    if (!user && !allowGuestTerminal) return json({ error: 'Authentication required' }, { status: 401 });

    const userId = user?.id ?? 'guest';
    const requestMeta = user ? meta : { ...meta, guestMode: true };

    let persistedMessage: ChatMessageRecord;
    if (user) {
      persistedMessage = await insertChatMessage({
        userId: user.id,
        channel,
        senderKind,
        senderId,
        senderName,
        message,
        meta: requestMeta,
      });
      await insertChatActivity({
        userId: user.id,
        sourceId: persistedMessage.id,
        payload: { channel, senderKind },
      });
    } else {
      persistedMessage = buildEphemeralRow({
        userId,
        channel,
        senderKind,
        senderId,
        senderName,
        message,
        meta: requestMeta,
      });
    }

    let agentResponse: ChatMessageRecord | null = null;

    if (channel === 'terminal' && senderKind === 'user') {
      // 1. @멘션 감지 → 2. 인텐트 기반 추론 → 3. ORCHESTRATOR 기본
      const mentionedAgent = detectMentionedAgent(message, { mentionedAgent: meta.mentionedAgent })
        || inferAgentFromIntent(message)
        || 'ORCHESTRATOR';

      const context = user ? await loadScanContext(user.id, meta) : null;
      const reply = await buildAgentReply(mentionedAgent, message, context, meta);
      const replyMeta = {
        ...requestMeta,
        mentionedAgent,
        responseSource: reply.source,
        scanId: reply.scanId,
      };

      if (user) {
        try {
          agentResponse = await insertChatMessage({
            userId: user.id,
            channel,
            senderKind: 'agent',
            senderId: reply.agentId,
            senderName: reply.agentId,
            message: reply.text,
            meta: replyMeta,
          });
          await insertChatActivity({
            userId: user.id,
            sourceId: agentResponse.id,
            payload: {
              channel,
              senderKind: 'agent',
              senderId: reply.agentId,
              source: reply.source,
            },
          });
        } catch (error) {
          console.warn('[chat/messages/post] failed to persist agent response:', error);
        }
      } else {
        agentResponse = buildEphemeralRow({
          userId,
          channel,
          senderKind: 'agent',
          senderId: reply.agentId,
          senderName: reply.agentId,
          message: reply.text,
          meta: replyMeta,
        });
      }
    }

    return json({
      success: true,
      guestMode: !user,
      message: persistedMessage,
      agentResponse,
    });
  } catch (error: unknown) {
    if (isRequestBodyTooLargeError(error)) {
      return json({ error: 'Request body too large' }, { status: 413 });
    }
    if (errorContains(error, 'DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    if (error instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[chat/messages/post] unexpected error:', error);
    return json({ error: 'Failed to create chat message' }, { status: 500 });
  }
};
