import { Request, Response } from 'express';
import { pool } from '../db/index.js';

export async function logAuditEvent(params: {
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress?: string;
  userAgent?: string;
  payloadDiff?: any;
}) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, payload_diff)
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [
        params.userId || null,
        params.action,
        params.resourceType,
        params.resourceId,
        params.ipAddress || null,
        params.userAgent || null,
        params.payloadDiff ? JSON.stringify(params.payloadDiff) : null,
      ]
    );
  } catch (err) {
    console.error('[Audit Log] Failed to write audit event:', err);
  }
}
