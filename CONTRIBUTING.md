# Contributing to AniScore

Thank you for your interest in contributing to AniScore! This guide will help
you get started with development.

## Development Setup

1. **Prerequisites**
   - [Bun](https://bun.sh) canary (package manager, runtime, linter and formatter): `bun upgrade --canary`.
     The project needs `bun lint` and `bun fmt`, which aren't in a stable release until Bun 1.4.4.
   - VS Code: install the recommended extensions. Run on Save formats files with `bun fmt` when you save them.

2. **Installation**

   ```bash
   git clone https://github.com/seahindeniz/ani-score.git
   cd ani-score
   bun install
   ```

3. **Development**

   ```bash
   bun run dev         # For Chrome/Chromium
   bun run dev-firefox # For Firefox
   ```

4. **Build for Production**

   ```bash
   bun run build
   ```

5. **Lint and Format**

   ```bash
   bun run lint    # bun lint, bun fmt --check and type checks
   bun run format  # format the repo with bun fmt
   ```

   The pre-commit hook formats and lints your staged files.

## Project Structure

- `src/sites/` - Site configs (one folder per supported site)
- `src/background/` - Background script logic
- `src/popup/` - Extension popup interface
- `src/sidepanel/` - Side panel interface

## Adding Support for New Anime Websites

To add support for a new anime streaming site or database:

A site is a config, not code: a folder in `packages/extension/src/sites/`.

The easiest way to write one is in the browser: right-click a page of the site and choose **Integrate this site with
AniScore**. The editor lets you pick the cards and what to read from them, previews AniScore's details on the page,
and saves the config to your sites. Its **Share with everyone** button opens a prefilled "Site integration" issue:
once a maintainer approves it (the `site-integration: approved` label), a pull request adds the site. No fork or
local setup needed. See [Add a Site](https://aniscore.link/guide/add-a-site) for a walkthrough.

To write one by hand instead:

1. **Copy an existing config**

   ```bash
   cp -r packages/extension/src/sites/anizm packages/extension/src/sites/your-site-id
   ```

2. **Edit `site.json`** (editors autocomplete it from `site.schema.json`)
   - `matches` - URL match patterns where the extension should activate
   - `pages` - which pages have episode cards, and for each card type: the
     card's selector, where its title, episode (and season) are read from,
     where the details are inserted, and which element shimmers
   - `theme` - a fixed theme, or a condition that tells when the site is dark

3. **Edit `style.css`** (optional) for layout fixes, such as the gap between
   cards. It's plain CSS with native nesting.

4. **Testing your implementation**
   - Run `bun run dev` to start development mode
   - Navigate to your target website
   - Verify that anime ratings appear correctly

## Need Help?

If you encounter issues while adding support for a new website or need
additional internal changes to the extension core:

- **Open an issue** in the repository to discuss your implementation
- Provide details about the target website and any specific challenges
- Include screenshots or examples of the anime cards/listings you're trying to
  enhance

## Code Standards

- Follow the existing TypeScript patterns
- Use SolidJS for reactive components
- Maintain consistent file structure
- Test your changes on the target website

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/add-site-name`)
3. Commit your changes (`git commit -m 'Add support for site-name'`)
4. Push to the branch (`git push origin feature/add-site-name`)
5. Open a Pull Request

## Releasing (maintainers)

Every push to `main` runs the Release workflow. It bumps the version from the commits, signs the Firefox build on AMO (unlisted), creates the GitHub release with the zip, crx and xpi, and then uploads the zip to the Chrome Web Store and submits it for review. To release a different version than the one derived from the commits (for example when AMO already has that version), run the workflow manually with its `version` input.

The Chrome Web Store job authenticates without a stored key: GitHub's OIDC token is exchanged for a token of a Google Cloud service account through Workload Identity Federation. It is skipped until the `CHROME_PUBLISHER_ID` variable exists. One-time setup, with the [gcloud CLI](https://cloud.google.com/sdk/docs/install):

1. In a Google Cloud project, enable the Chrome Web Store API and the IAM Service Account Credentials API, and create the service account:

   ```sh
   PROJECT_ID=your-project-id
   gcloud services enable chromewebstore.googleapis.com iamcredentials.googleapis.com --project "$PROJECT_ID"
   gcloud iam service-accounts create ani-score-publisher --project "$PROJECT_ID"
   ```

2. Let this repository's workflows use the service account:

   ```sh
   gcloud iam workload-identity-pools create github --project "$PROJECT_ID" --location global
   gcloud iam workload-identity-pools providers create-oidc ani-score --project "$PROJECT_ID" --location global \
     --workload-identity-pool github \
     --issuer-uri https://token.actions.githubusercontent.com \
     --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
     --attribute-condition "assertion.repository == 'seahindeniz/ani-score'"

   POOL=$(gcloud iam workload-identity-pools describe github --project "$PROJECT_ID" --location global --format 'value(name)')
   gcloud iam service-accounts add-iam-policy-binding "ani-score-publisher@$PROJECT_ID.iam.gserviceaccount.com" \
     --project "$PROJECT_ID" \
     --role roles/iam.workloadIdentityUser \
     --member "principalSet://iam.googleapis.com/$POOL/attribute.repository/seahindeniz/ani-score"

   # The value for GCP_WORKLOAD_IDENTITY_PROVIDER
   gcloud iam workload-identity-pools providers describe ani-score --project "$PROJECT_ID" --location global \
     --workload-identity-pool github --format 'value(name)'
   ```

3. In the Chrome Web Store Developer Dashboard, add `ani-score-publisher@<project-id>.iam.gserviceaccount.com` under **Account** (a publisher can have one service account), and copy the publisher ID from **Publisher > Settings**.

4. In the repository's `Production` environment, add these variables:
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`: the provider name printed in step 2 (`projects/<number>/locations/global/workloadIdentityPools/github/providers/ani-score`)
   - `CHROME_SERVICE_ACCOUNT`: `ani-score-publisher@<project-id>.iam.gserviceaccount.com`
   - `CHROME_PUBLISHER_ID`: the publisher ID from step 3

If the upload or submission fails, fix the cause and use **Re-run failed jobs**: the `publish-chrome` job uploads the existing release's zip, so nothing is released again. The store only accepts a version higher than its last upload.

We appreciate your contributions to making AniScore support more anime websites!
