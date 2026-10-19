# SEO content plan

The aim is a small set of high-quality, fact-checked pages, added gradually. No thin or templated pages.

## Where search intent is served

| Search topic | URL | Type | Status |
| --- | --- | --- | --- |
| Texas Registered Agent | `/registered-agent/texas` | State product page (`src/content/states.ts`) | **Live**; facts verified against Texas SOS |
| Registered Agent by State | `/registered-agent/states` | Coverage index | **Live**; lists availability honestly |
| Texas LLC Formation | `/start-an-llc` | Product page | **Live** |
| Registered agent (generic) | `/registered-agent` | Product page | **Live** |
| Can I Be My Own Registered Agent? | `/guides/can-i-be-my-own-registered-agent` | Guide | Draft written; needs review |
| How to Start an LLC in Texas | `/guides/how-to-start-an-llc-in-texas` | Guide | Outline |
| Registered Agent Cost in Texas | `/guides/registered-agent-cost-in-texas` | Guide | Outline |
| How to Change Registered Agent | `/guides/how-to-change-registered-agent` | Guide | Outline (cite Form 401) |
| Texas LLC Cost | `/guides/texas-llc-cost` | Guide | Outline |

## How the pipeline works

- **Guides** are Markdown files in `content/guides/`. Frontmatter fields: `title`, `description`, `status`, `updated`, `category`, `keywords`.
- **Drafts** (`status: draft`):
  - are visible in development, with a banner;
  - return 404 in production;
  - are `noindex`;
  - are excluded from the sitemap.
- **Publishing** means setting `status: published` and updating `updated`. The guide then appears in `/guides`, the sitemap, and gets Article and Breadcrumb JSON-LD.
- `{{brand.name}}` and similar placeholders are filled from live settings.
- **State pages** appear only when both conditions hold:
  - the state is enabled for registered agent sales (Admin → Services);
  - the state has written content in `src/content/states.ts`.

  Don't add a state without real, verified content.

## Editorial standard (each page)

1. Answer the searcher's question in the first paragraph.
2. Verify facts against primary sources (Secretary of State, Comptroller, statute), and link those sources.
3. Use live prices from settings, never hard-coded numbers.
4. Avoid legal advice. Include the "general information, not legal advice" line.
5. Add internal links to the relevant product page and one or two related guides.
6. Review at least yearly, and update the `updated` date.
