import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

// ── Types ────────────────────────────────────────────────────

type RbacRoleTier = 'student' | 'faculty' | 'staff' | 'super_admin';
type LifecycleState = 'active' | 'archived_read_only';

interface UserAccountRow {
  id: string;
  email: string;
  role: RbacRoleTier;
  state: LifecycleState;
}

// Augment Express Request so downstream handlers get typed access.
declare global {
  namespace Express {
    interface Request {
      authUser?: { id: string; email: string };
      dbUser?: UserAccountRow;
    }
  }
}

// HTTP methods that mutate server state — archived accounts are blocked from these.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE']);

// ── Supabase admin client (singleton) ────────────────────────
// Uses the service-role key so queries bypass Row-Level Security.

let _adminClient: SupabaseClient | null = null;

function adminClient(): SupabaseClient {
  if (_adminClient) return _adminClient;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set.',
    );
  }

  _adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _adminClient;
}

// ── authenticateJWT ──────────────────────────────────────────
// Validates the Bearer token in the Authorization header against
// Supabase Auth and attaches the verified identity to req.authUser.
// Must run before enforceRBAC on any protected route.

export async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header missing or malformed.' });
    return;
  }

  const token = authHeader.slice(7);
  const { data, error } = await adminClient().auth.getUser(token);

  if (error || !data.user?.email) {
    res.status(401).json({ error: 'Token is invalid or has expired.' });
    return;
  }

  req.authUser = { id: data.user.id, email: data.user.email };
  next();
}

// ── enforceRBAC ──────────────────────────────────────────────
// Factory that returns a middleware enforcing two constraints:
//
//   1. Role gate   — caller's role must be in allowedRoles.
//   2. Archive gate — archived_read_only accounts are hard-blocked
//                     from any mutating request (POST / PUT / DELETE).
//
// Requires authenticateJWT to have run first.

export function enforceRBAC(allowedRoles: RbacRoleTier[]): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Request is not authenticated.' });
      return;
    }

    const { data: dbUser, error } = await adminClient()
      .from('users_account_registry')
      .select('id, email, role, state')
      .eq('email', req.authUser.email)
      .single<UserAccountRow>();

    if (error || !dbUser) {
      res.status(403).json({ error: 'Caller is not registered in the account registry.' });
      return;
    }

    // Absolute boundary: archived accounts may never mutate data.
    if (dbUser.state === 'archived_read_only' && MUTATING_METHODS.has(req.method)) {
      res.status(403).json({
        error: 'Account is archived. Write operations are permanently disallowed.',
      });
      return;
    }

    if (!allowedRoles.includes(dbUser.role)) {
      res.status(403).json({
        error: `Role '${dbUser.role}' is not authorized for this resource.`,
      });
      return;
    }

    req.dbUser = dbUser;
    next();
  };
}
