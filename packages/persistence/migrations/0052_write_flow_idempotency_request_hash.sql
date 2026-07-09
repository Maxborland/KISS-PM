-- Bind write-flow idempotency keys to the request payload. Without a stored hash, reusing the same
-- clientRequestId with a different body returns the previous resource as a 201 and silently drops
-- the new content. Nullable so existing rows (written before this column) remain valid; the claim
-- path treats a null stored hash as non-conflicting for backward compatibility.
ALTER TABLE "write_flow_idempotency_keys"
  ADD COLUMN IF NOT EXISTS "request_hash" text;
