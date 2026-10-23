import test from 'node:test';
import assert from 'node:assert/strict';
import { WasteWiseApiClient, WasteWiseApiError, getOrCreateSessionId, resetSessionId } from '../src/services/apiClient.ts';

test('apiClient generates and maintains persistent session identifier', () => {
  // Test fallback session generation in node environment
  const sid = getOrCreateSessionId();
  assert.ok(sid);
  assert.ok(typeof sid === 'string');

  const newSid = resetSessionId();
  assert.ok(newSid);
});

test('apiClient WasteWiseApiError contains status, code, and message', () => {
  const err = new WasteWiseApiError('No active guide', 'NO_ACTIVE_GUIDE', 404, 'req-123');
  assert.equal(err.name, 'WasteWiseApiError');
  assert.equal(err.message, 'No active guide');
  assert.equal(err.code, 'NO_ACTIVE_GUIDE');
  assert.equal(err.status, 404);
  assert.equal(err.requestId, 'req-123');
});

test('apiClient normalizes baseUrl correctly without trailing slashes', () => {
  const client1 = new WasteWiseApiClient('http://localhost:8080/api/v1/');
  assert.equal(client1.getBaseUrl(), 'http://localhost:8080/api/v1');

  const client2 = new WasteWiseApiClient('http://localhost:8080/api/v1///');
  assert.equal(client2.getBaseUrl(), 'http://localhost:8080/api/v1');
});
