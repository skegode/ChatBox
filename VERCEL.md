Vercel deployment notes

1) Connect repository
- Go to https://vercel.com, sign in, and import this Git repository (GitHub/GitLab/Bitbucket).

2) Build command
- Vercel auto-detects Next.js; default build command `npm run build` is fine.

3) Required environment variables
- `NEXT_PUBLIC_API_URL` (recommended): public URL your frontend should call (e.g. https://api.example.com or same as BACKEND_URL).
- `BACKEND_URL` (server-side): base URL for server-side proxy routes. Example: `https://app.servicesuitecloud.com/WhatsappApi`.
- `NEXT_PUBLIC_APP_URL` (recommended): the canonical frontend URL (example: `https://chat.servicesuitecloud.com`). Used when requesting password reset links.
- Optionally set `NEXT_PUBLIC_LOCAL_API` for local dev override.

4) Notes
- The repo currently sets `eslint.ignoreDuringBuilds` in `next.config.ts` to avoid build failures from lint during early deployment. Fix lint warnings and remove that option when ready.
- Server-side proxy routes read `BACKEND_URL` (fallbacks to `NEXT_PUBLIC_API_URL` or the original default if unset).
- If you need rewrites/redirects, edit `vercel.json` to add them.

5) Quick deploy steps
- Import the repo on Vercel and set the env vars in the Vercel project settings.
- Trigger a new deploy (Vercel will run `npm run build`).

6) Troubleshooting
- If build fails due to ESLint, either fix issues or temporarily keep `ignoreDuringBuilds` (not recommended long-term).
- If API proxy responses are 4xx/5xx, verify `BACKEND_URL` and any auth headers required by the backend.

---

Recommended environment variables (set these in Vercel Project → Settings → Environment Variables)
- `NEXT_PUBLIC_API_URL` (string): Public URL the frontend should use to call your API in production (example: `https://api.mychatbox.example`). Used client-side.
- `BACKEND_URL` (string): Backend base URL used by server-side routes and the image proxy (example: `https://api.mychatbox.example`).
- `NEXT_PUBLIC_APP_URL` (string): Canonical frontend URL used for reset-link callbacks (example: `https://chat.servicesuitecloud.com`).
- `NEXT_PUBLIC_LOCAL_API` (optional, string): Local backend used during development (example: `http://localhost:5265`).
- `JWT_SECRET`, `OTHER_API_KEY` (as required): any server-side secrets required by your backend. Mark as "Secret" in Vercel.

Password reset links
- Ensure backend email templates generate reset links to your frontend host (for this deployment: `https://chat.servicesuitecloud.com/password-reset?...`).
- If your backend accepts callback fields on forgot-password, this frontend now sends `ResetUrl`, `ResetLinkBase`, and `FrontendBaseUrl`.

Deploy checklist
1. Confirm repository is connected to Vercel and the correct branch is selected.
2. In Vercel → Project → Settings → Environment Variables, add `NEXT_PUBLIC_API_URL`, `BACKEND_URL`, and `NEXT_PUBLIC_APP_URL` for Preview and Production as appropriate.
3. Trigger a new deploy (push to branch or click "Redeploy").
4. Review build logs; if `next build` fails, copy-paste the error output here and I'll diagnose.

Optional quick fixes I can add for you
- Add a small server-side proxy route `app/api/proxy/[...path]/route.ts` to map `/api/Messages/contact/{id}` to a different backend path without changing the backend.
- Increase the `Cache-Control` TTL in `app/api/image/proxy/route.ts` to reduce thumbnail re-fetching (helpful for Vercel deployments).

If you want me to add either of the above, say which one and I'll create the file and update `vercel.json` accordingly.
