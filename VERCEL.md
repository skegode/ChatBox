Vercel deployment notes

1) Connect repository
- Go to https://vercel.com, sign in, and import this Git repository (GitHub/GitLab/Bitbucket).

2) Build command
- Vercel auto-detects Next.js; default build command `npm run build` is fine.

3) Required environment variables
- `NEXT_PUBLIC_API_URL` (recommended): public URL your frontend should call (e.g. https://api.example.com or same as BACKEND_URL).
- `BACKEND_URL` (server-side): base URL for server-side proxy routes. Example: `https://app.servicesuitecloud.com/WhatsappApi`.
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
