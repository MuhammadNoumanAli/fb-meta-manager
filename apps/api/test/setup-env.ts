/**
 * Deterministic Meta credentials for end-to-end tests. Values are only used
 * while the test application runs; the Graph API is mocked in every suite.
 */
process.env.META_APP_ID = process.env.META_APP_ID || 'phase4-test-app-id';
process.env.META_APP_SECRET = process.env.META_APP_SECRET || 'phase4-test-app-secret';
process.env.META_REDIRECT_URI =
  process.env.META_REDIRECT_URI || 'http://localhost:3000/api/v1/integrations/meta/oauth/callback';
process.env.META_WEBHOOK_VERIFY_TOKEN =
  process.env.META_WEBHOOK_VERIFY_TOKEN || 'phase4-test-verify-token';
process.env.UPLOAD_DIRECTORY = process.env.UPLOAD_DIRECTORY || 'var/test-uploads';
