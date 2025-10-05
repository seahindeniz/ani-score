# Contributing to AniScore

Thank you for your interest in contributing to AniScore! This guide will help
you get started with development.

## Development Setup

1. **Prerequisites**
   - Node.js (v18+)
   - pnpm package manager

2. **Installation**
   ```bash
   git clone https://github.com/seahindeniz/ani-score.git
   cd ani-score
   pnpm install
   ```

3. **Development**
   ```bash
   pnpm dev        # For Chrome/Chromium
   pnpm dev-firefox # For Firefox
   ```

4. **Build for Production**
   ```bash
   pnpm build
   ```

## Project Structure

- `src/contentScripts/site/` - Site-specific implementations
- `src/background/` - Background script logic
- `src/popup/` - Extension popup interface
- `src/sidepanel/` - Side panel interface

## Adding Support for New Anime Websites

To add support for a new anime streaming site or database:

1. **Clone the existing implementation**
   ```bash
   cp -r src/contentScripts/site/anizm src/contentScripts/site/your-site-name
   ```

2. **Update the site configuration**
   - Modify `meta.ts` to match your target website's URL patterns
   - Update `main.ts` to implement site-specific logic for finding anime cards
   - Customize `global.scss` for any required styling

3. **Key files to modify**:
   - `meta.ts` - Define URL patterns where the extension should activate
   - `main.ts` - Implement the `SiteBaseConfig` interface to identify anime
    cards and episodes
   - `global.scss` - Add any custom styling needed for the site

1. **Testing your implementation**
   - Run `pnpm dev` to start development mode
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

We appreciate your contributions to making AniScore support more anime websites!
