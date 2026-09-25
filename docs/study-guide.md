# Running the learning study

Study mode measures whether question-first learning works: a pre-test, learning in Qurious, and the same test afterwards, plus a log of what each participant did.

## Before any data is collected

- [ ] Review and finalize the **consent text** in `web/src/components/study/StudyFlow.tsx`, and bump `CONSENT_VERSION` in both `api/app/routes/study.py` and `web/src/lib/study.ts`. It's currently `v1-draft`.
- [ ] Review the **pre/post-test** in `content/study/assessment.yaml` (9 items, draft), then set `status: reviewed`.
- [ ] Review the **lessons** on the study paths (all `draft`).
- [ ] Get ethics approval if your institution requires it. Two items were added beyond the brief for this reason: an "18 or older" line and a **withdraw** button. Keep or remove them to match your approval.
- [ ] Configure **Supabase** (container disks aren't permanent) and set `STUDY_ADMIN_TOKEN`.
- [ ] Set `NEXT_PUBLIC_STUDY_CONTACT` to the researcher's contact details.
- [ ] Switch on `STUDY_ENABLED=true` (API) and `NEXT_PUBLIC_STUDY_MODE=true` (web), then redeploy.

## What a participant does

1. Opens `/study`, reads the information sheet, optionally enters a **study code** (use one per cohort or session, e.g. `fall-lab-1`), and consents.
2. Takes the pre-test (no feedback is shown).
3. Learns with Qurious as normal. A slim banner shows their research id and the way to the final quiz.
4. Takes the post-test (the same items).
5. Sees their research id, with the option to withdraw, which deletes all their data.

## What is recorded

| Table | Contents |
| --- | --- |
| `participants` | random research id (`P-XXXXXXXX`), optional study code, consent version and time |
| `test_responses` | pre/post, item id, chosen option, correct or not, time on the item |
| `study_events` | `question_selected`, `diagnostic_answered`, `path_started`, `concept_started`, `step_viewed` (with time on the previous step), `check_attempt` (correct, attempt number), `puzzle_attempt`/`puzzle_skipped`, `math_opened`, `detour_started`, `concept_completed` (duration), `reward_reached`, `tutor_question` (whether it was supported), `page_hidden` (the drop-off point) |

Nothing else is stored: no names, emails, IP addresses or device details. Study tables can only be read with the backend's secret key.

For consistency, LLM hook personalization is switched off for participants, so everyone sees the same reviewed text.

## Exporting data

```bash
TOKEN=<STUDY_ADMIN_TOKEN>
API=https://<your-api>
curl -H "Authorization: Bearer $TOKEN" $API/study/export/summary.csv -o summary.csv
curl -H "Authorization: Bearer $TOKEN" $API/study/export/study_events.csv -o events.csv
curl -H "Authorization: Bearer $TOKEN" $API/study/export/test_responses.csv -o tests.csv
curl -H "Authorization: Bearer $TOKEN" $API/study/export/participants.csv -o participants.csv
curl -H "Authorization: Bearer $TOKEN" $API/study/export/question_log.csv -o question_log.csv
```

`summary.csv` has one row per participant: pre/post correct and answered counts, concepts completed, check attempts and first-try correct checks, detours, rewards reached, active time, and the **last event and concept** (the drop-off point).
