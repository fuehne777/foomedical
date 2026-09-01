# Threat model

Scope: this SPA and the FHIR calls it makes. Medplum hosted FHIR is trusted for persistence; the browser is not. Use synthetic examples only (`Patient/example-1`). Never put real patient data in issues, comments, commits, or diffs.

## Trust boundaries

1. **Browser.** The bundle, session token, and any `console.*` output are visible to the signed-in user and to XSS.
2. **This origin (Vercel).** Static files + SPA rewrite. No application server. Deploy headers, if any, live in `vercel.json`.
3. **Medplum.** AccessPolicy, membership, and operation implementations are the only authorization.
4. **Public SHL retrieval.** A generated SMART Health Link is redeemable without the portal session (`fetch` to the link URL).

Client search parameters (for example `PaymentNotice?request:Claim.patient=Patient/example-1`) are not an AccessPolicy.

## STRIDE snapshot

| ID | Threat | Boundary | Status |
| --- | --- | --- | --- |
| T1 | Booking policy only in the browser | Medplum `$find` / `$hold` | Open — [#2](https://github.com/fuehne777/foomedical/issues/2) |
| T2 | SMART Health Link is a live PHI export | Public link + header menu | Open — [#3](https://github.com/fuehne777/foomedical/issues/3) |
| T3 | Non-Patient profiles get the patient shell | `App.tsx` gate | Open — [#4](https://github.com/fuehne777/foomedical/issues/4) |
| T4 | Full-resource `Patient` update | Profile form | Open — [#5](https://github.com/fuehne777/foomedical/issues/5) |
| T5 | Screening / intake answers not persisted; were logged | Questionnaire pages | Partially reduced — [#6](https://github.com/fuehne777/foomedical/issues/6) |
| T6 | Patient vitals look clinical; were logged | `Observation` create | Partially reduced — [#7](https://github.com/fuehne777/foomedical/issues/7) |
| T7 | Defaults register into the shared demo project | `.env.defaults` | Open — [#8](https://github.com/fuehne777/foomedical/issues/8) |
| T8 | First `Schedule` in the project | Get Care | Open — [#2](https://github.com/fuehne777/foomedical/issues/2) |
| T9 | Billing search wider than the signed-in patient | `PaymentNotice` | Partially reduced — [#9](https://github.com/fuehne777/foomedical/issues/9) |
| T10 | No deploy security headers; XSS = token theft | Vercel | Open — [#9](https://github.com/fuehne777/foomedical/issues/9) |
| T11 | Home CTAs that do not match routes | Home | Partially reduced — [#10](https://github.com/fuehne777/foomedical/issues/10) |

## Detail

### T1 / T8 — Get Care booking and Schedule selection

`GetCarePage` loads `useSearchOne('Schedule')` (first resource), then `$find` / `$hold`. Hours, `Patient.active`, and practitioner selection are not enforced on Medplum in this repo. A second client can hold an appointment the SPA would hide.

PR #1 (open) adds a client-only window/active guard. That is UX. Do not fold it into `App.tsx`.

Home hero **Get Care** now routes to `/get-care`, so this path is reachable from the default signed-in screen. That does not change the trust boundary; it makes T1/T8 easier to hit.

### T2 — SMART Health Links

`/smart-health-links` is in the signed-in menu. It generates a 15-minute link, copies it, shows a QR code, and retrieves the payload with unauthenticated `fetch`. Direct mode disables passcode. Treat as production export, not a hidden demo.

### T3 — Profile-present gate

`if (!medplum.getProfile())` is the only session check. A Practitioner (or other) login receives the patient `Router`. Pages then cast the profile as `Patient`. Fix: require `resourceType === 'Patient'` (or a Patient-linked membership) and send other roles to an error/sign-out. Do not encode booking or clinical eligibility in this gate.

### T4 — Profile write

`Profile.tsx` spreads the current `Patient` and `updateResource`s name, birth date, gender, and address. Concurrent clinician edits can be overwritten. Email is already read-only in the UI.

### T5 — Screening and intake

`/screening-questionnaire` and `/patient-intake-questionnaire` show thank-you and drop the `QuestionnaireResponse`. `/Questionnaire/:id` is the persist path. PR #11 removed `console.log` of screening answers. Residual: persist or mark as non-clinical demos.

### T6 — Patient-entered vitals

Vitals `createResource` an `Observation` with `status: 'preliminary'` and no performer/category that marks it patient-entered. Blood-pressure components are hard-coded to diastolic LOINC. PR #11 removed `console.log(formData)`. Create still `.catch(console.error)`, which can print FHIR OperationOutcome text.

### T7 — Demo project defaults

First `npm run dev` copies `.env.defaults` to `.env`. The committed project id is a shared demo. Local register can create patients there.

### T9 — PaymentNotice scope

Coverage was already `beneficiary` = signed-in profile. PaymentNotice had no patient filter.

PR #11 searches:

`PaymentNotice?request:Claim.patient=Patient/example-1`

That matches Coverage-style hygiene. It is still a client query. Least-privilege AccessPolicy on `PaymentNotice` / `Claim` remains required. If the chained parameter is ignored or unindexed, the UI may show nothing or (worse, if the server ignores unknown params) too much — confirm on the target Medplum.

### T10 — Deploy headers

`vercel.json` only rewrites unknown paths to `/`. No CSP, HSTS, `X-Content-Type-Options`, or referrer policy. Google Identity Services is loaded from `accounts.google.com` in `index.html`. Tokens are in the browser, so XSS is full session theft. Ignoring `.vercel` keeps local deploy metadata out of git; it does not add headers.

### T11 — Home CTAs

| Control | After PR #11 |
| --- | --- |
| Hero **Get Care** | Navigates to `/get-care` |
| **Send Message** | Still `/messages` (route is `/Communication`) |
| Carousel provider card | Still `/account/provider/choose-a-primary-care-povider` (no route) |
| Medication renewal | Modal submit still writes nothing |
| Provider choose | `account/Provider` still TODO |

## What is out of scope for the SPA

- Encoding appointment hours or clinical eligibility in `App.tsx`
- Treating client search filters as AccessPolicy
- Putting real questionnaire answers or chart rows in fixtures, issues, or review comments
