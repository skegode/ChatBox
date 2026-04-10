# Attachment Regression Tests

Run these manual test cases after frontend and backend contract updates.

## 1) Text-only send
- Open a chat.
- Send message text: `hello text only`.
- Expected:
  - Message renders as plain text bubble.
  - No attachment card is shown.
  - No file icon/filename is shown.

## 2) Attachment-only send
- Attach a file, keep text empty, send.
- Expected:
  - Attachment card is rendered.
  - Filename uses `mediaFileName` first, then `fileName`.
  - Generic `Document` appears only when both names are missing.

## 3) Text + attachment send
- Attach a file and add text, then send.
- Expected:
  - Text is rendered.
  - Attachment card is rendered with filename.
  - Download/open works and prefers `mediaUrl` when present.

## 4) Text after attachment regression guard
- Immediately after sending an attachment, send text-only.
- Expected:
  - New text message has no attachment card.
  - No leaked media metadata from previous message.

## 5) Reconciliation check
- Send with optimistic UI enabled.
- Wait for server refresh.
- Expected:
  - Message fields match backend response.
  - No synthetic media ids are created.
  - Attachment state follows `messageType` only.
