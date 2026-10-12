#!/usr/bin/env node
// SECURITY: Direct service-role role assignment is intentionally disabled.
// Create a normal account, then bootstrap exactly one super-admin via the documented
// SQL Editor query in supabase/bootstrap-superadmin.sql.example. Thereafter the
// super-admin must use the grant_admin_role RPC through the authenticated admin UI.
console.error('Disabled for security. Follow SETUP.md and supabase/bootstrap-superadmin.sql.example.');
process.exit(1);
