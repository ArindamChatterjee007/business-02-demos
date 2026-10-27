<!-- business02-demo-library -->
# Personal Demo Library

Self-initiated, AI-assisted software experiments and fictional visual studies by Arindam Chatterjee. All example records are synthetic. No client work, customer results, application counts or earnings are implied.

## Demos

- Form Desk: interactive browser-local PDF form validation and Excel export, rebuilt and tested remotely.
- PDF-to-XLSX pipeline: synthetic forms, field mapping, workbook and evidence.
- Project Tracker: responsive frontend screenshot case study, not a hosted backend.
- Waypoint, The Mendery and Lantern Row: fictional identity concepts.
- Queue verification: synthetic benchmark evidence, not client applications.

## Current Deployment

The five previously verified case studies are hosted at https://arindamchatterjee007.github.io/business-02-demos/ through GitHub Pages from main/docs. Form Desk source is included, but its interactive build is not hosted until browser acceptance passes. The custom manual/nightly test workflow is currently an inactive template at demos/publish-demos.workflow.yml: the available CLI authorization lacks workflow-upload scope. Only the standard Pages build/deployment is active. No local browser test or overnight outreach process is running.

## Remote Verification

The provided workflow is designed to use standard Ubuntu runners, one job at a time, with a 15-minute timeout after activation. Manual, main-branch updates and a nightly schedule run unit checks, build Form Desk, test its real downloads and mobile/desktop views, then publish verified static output to the gh-pages branch. No browser accounts, outreach, personal data or paid client work is involved. No cache or Actions artifact retention is configured; evidence lives in the generated branch and run logs.

Build requirements: Node 24, Poppler pdftoppm, Chromium via Playwright. Run npm ci, npm test and npm run build. Third-party license notices accompany the generated artifacts.

The full private operational record and archive are separate. This public repository deliberately excludes account state, client correspondence, resumes, identity documents, browser sessions and credentials.
