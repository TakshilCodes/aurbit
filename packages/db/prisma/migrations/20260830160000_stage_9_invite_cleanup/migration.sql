-- Existing invitation indexes are workspace-scoped; maintenance scans by expiry.
CREATE INDEX "organization_invites_expires_at_idx" ON "organization_invites"("expires_at");
