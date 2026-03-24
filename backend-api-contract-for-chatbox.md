Backend API Contract — ChatBox

Purpose
- This file documents the minimal endpoints, payloads, behavior and verification steps your backend agent must provide so the ChatBox frontend can load conversations and show referral sources.

Requirements
1) GET chats list
- URL: GET /api/Chats
- Query: optional pagination (page, limit)
- Response 200: JSON array of chat summary objects
  {
    "id": "conv-1",
    "title": "John Doe",
    "contactId": "256741909545",
    "lastMessage": "See you soon",
    "lastUpdated": "2026-03-23T12:00:00Z",
    "unreadCount": 2
  }
- Errors: 401 unauthorized, 500 server error
- Usage: used by the frontend conversation list (`ChatList`) to render customers and last messages

2) GET messages by contact (required)
- Primary URL (frontend expects this): GET /api/Messages/contact/{contactId}
- Alternative accepted URL (optional): GET /api/Messages?contactId={contactId}
- Path param: {contactId} — can be numeric or a phone string (may include leading `+`) — server should accept and normalize both
- Response 200: JSON array of message objects (ordered by timestamp ascending or descending; frontend can accept either but include `timestamp`)
  [
    {
      "id": "msg-123",
      "conversationId": "conv-1",
      "contactId": "256741909545",
      "from": "+15551234567",
      "to": "+15557654321",
      "text": "hello",
      "timestamp": "2026-03-23T12:34:56Z",
      "direction": "inbound"  // or "outbound"
    }
  ]
- Errors: 404 if contact/conversation not found, 401, 500

3) POST send message
- URL: POST /api/Messages/send  (or POST /api/Messages)
- Request JSON:
  {
    "conversationId": "conv-1",        // optional if not applicable
    "contactId": "256741909545",      // required (id or phone)
    "from": "+15557654321",
    "to": "+15551234567",
    "text": "message text"
  }
- Response 201: created message object (same shape as GET)

4) Prospect update / referral source
- When a prospect is created or updated via merchant or client referral APIs, include explicit referral metadata in the payload the frontend reads
- Example fields to include in prospect create/update response or webhook:
  {
    "id": "p-1",
    "name": "Alice",
    "referrerId": "m-123",            // optional
    "referrerType": "merchant",       // "merchant" or "client" (case-insensitive)
    "referrerName": "Merchant Name",
    "referrerPhone": "+15550001111"
  }
- Frontend logic: map `referrerType` === "merchant" -> display "Merchant", "client" -> "Client". If `referrerType` omitted, backend should provide it rather than relying on conventions.

Non-functional requirements
- CORS: allow requests from http://localhost:3000 (dev) and your production origin. Allow methods GET, POST, PUT, OPTIONS. If using cookies, set Access-Control-Allow-Credentials: true and allow credentials on frontend requests.
- Auth: accept the same auth scheme your frontend uses (Bearer JWT header or cookies). Document header (e.g., `Authorization: Bearer <token>`).
- ID formats: accept contact identifiers as either plain numeric strings or E.164 phone strings (with leading `+`) and normalize server-side. The frontend may call with either format.
- Response times: typical GET responses should be fast (<300ms) for good UX.

Acceptance tests (curl examples)
- Chats list:
  curl -s -H "Accept: application/json" http://localhost:5265/api/Chats | jq

- Messages by contact (path):
  curl -i http://localhost:5265/api/Messages/contact/256741909545

- Messages by contact (query):
  curl -i "http://localhost:5265/api/Messages?contactId=256741909545"

- Send message:
  curl -i -X POST http://localhost:5265/api/Messages/send \
    -H "Content-Type: application/json" \
    -d '{"contactId":"256741909545","from":"+15557654321","to":"+15551234567","text":"test"}'

- CORS check from frontend origin:
  curl -i -H "Origin: http://localhost:3000" http://localhost:5265/api/Messages/contact/256741909545

OpenAPI snippet (messages paths)
paths:
  /api/Messages/contact/{contactId}:
    get:
      summary: Get messages for a contact
      parameters:
        - in: path
          name: contactId
          required: true
          schema:
            type: string
      responses:
        '200':
          description: array of messages
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Message'
        '404':
          description: contact not found
  /api/Messages:
    get:
      summary: Get messages by query
      parameters:
        - in: query
          name: contactId
          schema:
            type: string

components:
  schemas:
    Message:
      type: object
      properties:
        id:
          type: string
        conversationId:
          type: string
        contactId:
          type: string
        from:
          type: string
        to:
          type: string
        text:
          type: string
        timestamp:
          type: string
          format: date-time
        direction:
          type: string

Notes for the backend agent
- If you cannot add `GET /api/Messages/contact/{contactId}`, add a lightweight mapping/proxy that accepts that exact path and internally calls your existing messages route. This is the quickest fix without changing existing handlers.
- Ensure the prospect update endpoint includes `referrerType` as described. Frontend relies on this for the Merchant/Client badge.

Deliverable
- Give this file to the backend agent. If you prefer, I can also generate a runnable small proxy (`app/api/proxy/[...path]/route.ts`) that translates `/api/Messages/contact/{id}` to any URL you tell me.

If you confirm which option you want (update backend vs add proxy), I can either produce a small proxy file or a more detailed OpenAPI spec file.
