# Deploying Qurious

Two pieces: the **web app** on Vercel, and the **API** on Render (free) or Hugging Face Spaces. Optional services: Groq and Gemini (tutor LLM), Supabase (accounts and study data), IBM Quantum (real hardware).

## 1. API on Render (free)

The API uses about 330 MB, which fits Render's free 512 MB instance. The embedding model runs through ONNX (fastembed) instead of torch, and Qiskit is imported only for real-hardware runs. Free instances sleep after 15 minutes idle, so the first request after that takes about a minute; the web app shows "Waking up the server…" meanwhile.

1. At <https://dashboard.render.com> choose **New → Blueprint** and connect this GitHub repository. Render reads `render.yaml` and builds the root `Dockerfile`.
2. Fill in the variables it asks for:

   | Name | Value |
   | --- | --- |
   | `CORS_ORIGINS` | `["https://<your-vercel-domain>"]` |
   | `GROQ_API_KEY`, `GEMINI_API_KEY` | optional; the tutor works without them |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | optional; use the new **secret** key (`sb_secret_…`) |
   | `STUDY_ADMIN_TOKEN` | a long random string, for CSV export |
   | `IBM_QUANTUM_TOKEN` | optional |

   `LLM_PRIMARY_MODEL`, `LLM_FALLBACK_MODEL` and `STUDY_ENABLED` come preset from `render.yaml`.
3. Check it with `https://<service>.onrender.com/health`, which should return `{"status":"ok",…}`.

**Alternative, Hugging Face Spaces:** the same `Dockerfile` runs as a Docker Space (creating one may need a paid account). The Space's `README.md` must start with front matter containing `sdk: docker` and `app_port: 7860`; set the same variables under **Settings → Variables and secrets**.

> Without Supabase, study data is written to SQLite inside the container, and **container disks aren't permanent**. For a real study, configure Supabase.

## 2. Database on Supabase (optional)

1. Create a project at <https://supabase.com>.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor, or use `supabase db push`.
3. **Project Settings → API Keys**: copy the **publishable** key (`sb_publishable_…`) for the web app and the **secret** key (`sb_secret_…`) for the API. The legacy `anon` and `service_role` keys stop working at the end of 2026.
4. For optional accounts: **Authentication → URL configuration**, set the Site URL to your Vercel domain and add it to the redirect URLs (magic links return there).

## 3. Web app on Vercel

1. Import the repository at <https://vercel.com/new>.
2. Set **Root Directory** to `web`. Keep **"Include files outside the root directory in the Build Step"** enabled, because lessons are read from `../content`.
3. Add these environment variables:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | the API URL, e.g. `https://<service>.onrender.com` |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | optional; the **publishable** key |
   | `NEXT_PUBLIC_STUDY_MODE` | `false` until the study is approved |
   | `NEXT_PUBLIC_STUDY_CONTACT` | shown on the consent form |
   | `NEXT_PUBLIC_FEATURE_FREE_TEXT` | `false` (v2) |

4. Deploy. `NEXT_PUBLIC_*` values are built into the pages, so **redeploy after changing any of them**.

## 4. After deploying

- Visit the site and run through one journey. The preview screen shows "Waking up the server…" if the API was asleep.
- If you enabled accounts, send yourself a sign-in link and check that progress syncs.
- Supabase recommends a CAPTCHA (e.g. Cloudflare Turnstile) for public sign-ups. Enable it under **Authentication → Attack protection** before promoting the site widely.
