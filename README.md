# Online Testing System

This project is a general-purpose online testing system built with a Cloudflare Worker and Cloudflare D1 database. It can be used for questionnaires, assessments, surveys, training tests, and similar workflows where every participant needs a separate link.

## What the system does

An administrator creates one or more unique links from the admin page and sends a link to each participant. Each link represents one testing record.

The system provides the following behavior:

- Each participant receives a randomly generated unique link.
- The same link can be opened on a phone, tablet, or computer.
- The first time a link is opened, a five-day usage period begins.
- Answers are saved automatically while the participant is working.
- If the participant leaves before finishing, the same link can be used to continue later.
- After the test is completed, the answers and result are locked.
- Opening a completed link only shows the saved result; the test cannot be submitted again.
- After five days, the server deletes the link record, answers, and result. The link then becomes invalid.
- The system does not ask for or store names, phone numbers, or other personal information.

## How an administrator uses it

1. Open the deployed Worker URL followed by `/admin.html`.
2. Enter the administrator password configured as `ADMIN_SECRET`.
3. Choose how many links to create and optionally enter a customer label or order reference.
4. Click the generate button.
5. Copy each generated URL and send it to the corresponding participant.

The customer label is only an internal note for the administrator. It is not displayed as personal information to the participant.

## How a participant uses it

1. Open the unique URL received from the administrator.
2. Complete the questions. Progress is saved automatically.
3. If the browser or device is changed, open the same URL to continue.
4. Submit the test once to calculate the result.
5. Reopening the URL after completion displays the same result and does not allow another submission.

A unique URL is the access credential. Anyone who receives or forwards that URL can access the same testing record, so links should be sent privately.

## Data and privacy

The server stores only the information required to operate the workflow:

- A SHA-256 hash of the random access token (the original token is not stored in the database)
- The answer progress
- The final result
- Link status and timestamps
- An optional administrator-only label

The administrator password is stored as a Cloudflare Worker secret and must never be committed to this repository. No phone number, name, email address, or other identity information is required by this project.

## Project structure

```text
worker.js                       Cloudflare Worker API and asset handler
wrangler.toml                   Worker and D1 configuration
migrations/0001_links.sql       Initial D1 database schema
public/admin.html               Administrator link generator
public/question-example.html    Example testing page
public/access-gate.js            Link validation and server synchronization
README.md                       This documentation
README.zh-CN.md                 Chinese documentation backup
UPGRADE_FROM_OLD_VERSION.sql    Optional migration for an older database schema
```

## Requirements

- Node.js 20 or later
- A Cloudflare account
- Cloudflare Workers and D1 access
- A GitHub account is optional and is only needed to store the source code

## First-time deployment

Open PowerShell in this project folder and run the following commands:

```powershell
npx wrangler login
npx wrangler d1 create YOUR_DATABASE_NAME
```

Copy the `database_id` returned by the second command into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "YOUR_DATABASE_NAME"
database_id = "YOUR_DATABASE_ID"
```

Apply the database schema, set the administrator password, and deploy:

```powershell
npx wrangler d1 migrations apply YOUR_DATABASE_NAME --remote
npx wrangler secret put ADMIN_SECRET
npx wrangler deploy
```

If PowerShell blocks `npx.ps1`, use the Windows command directly:

```powershell
& "C:\Program Files\nodejs\npx.cmd" wrangler deploy
```

After deployment, Cloudflare displays a URL similar to:

```text
https://your-worker-name.your-subdomain.workers.dev
```

Use the following administrator URL:

```text
https://your-worker-name.your-subdomain.workers.dev/admin.html
```

The public testing page is served at the root URL. The Worker internally loads `question-example.html` so the root URL remains convenient for participants.

## Updating the testing page

The example questions and result presentation are in `public/question-example.html`. Edit that file to change the visible questions and styling, then deploy again:

```powershell
npx wrangler deploy
```

The server-side link, progress, locking, and expiration logic is in `worker.js`. Changes to that file should be tested before being used with real participants.

## Database cleanup

The Worker has an hourly scheduled trigger. It removes records whose five-day expiration time has passed. No computer needs to stay turned on after deployment; the Worker and scheduled cleanup run in Cloudflare.

## API overview

- `POST /api/admin/links` creates unique links and requires the `ADMIN_SECRET` bearer credential.
- `GET /api/session?token=...` validates a participant link and returns saved progress or the locked result.
- `POST /api/save` saves progress or the final result for a valid link.

These endpoints are intended to be called by the included pages. Do not expose the administrator password in browser code or in a public repository.

## License and reuse

This repository does not include a license by default. Add a license if you want to define how other people may reuse the code.
