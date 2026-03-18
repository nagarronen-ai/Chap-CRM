# TheKnot.com Vendor Scraper

A Python web scraper that collects vendor listings from TheKnot.com by state and category, including full contact and business information.

---

## Setup

```bash
pip install requests beautifulsoup4 lxml pandas tqdm
```

---

## Usage

### Scrape a specific state and category
```bash
python theknot_scraper.py --state new-york --category wedding-photographers
```

### Scrape multiple states and categories
```bash
python theknot_scraper.py --state new-york california texas --category wedding-photographers wedding-venues
```

### Scrape ALL states and ALL categories (full run — takes many hours)
```bash
python theknot_scraper.py
```

### Fast run (listing pages only, skip detail pages)
```bash
python theknot_scraper.py --state florida --no-details
```

### Custom output directory and rate limiting
```bash
python theknot_scraper.py --state georgia --output ./data --delay-min 2.0 --delay-max 5.0
```

---

## All CLI Options

| Option | Default | Description |
|--------|---------|-------------|
| `--state` | all states | One or more state slugs (e.g. `new-york`, `california`) |
| `--category` | all categories | One or more category slugs (see below) |
| `--max-pages` | 50 | Max listing pages per state+category combo |
| `--no-details` | False | Skip vendor detail pages (faster, less data) |
| `--delay-min` | 1.5 | Min seconds between requests |
| `--delay-max` | 3.5 | Max seconds between requests |
| `--output` | `./output` | Directory to save results |

---

## Available Categories

```
wedding-photographers      wedding-videographers
wedding-venues             wedding-bands-djs
wedding-florists           wedding-caterers
wedding-cakes-desserts     wedding-hair-makeup
wedding-planners           wedding-officiants
wedding-transportation     wedding-rentals
wedding-invitations        wedding-jewelry
wedding-dress-attire       wedding-rehearsal-dinner
wedding-lighting           honeymoon-travel
```

---

## Output Files

Results are saved in `./output/` (or your `--output` dir):

| File | Description |
|------|-------------|
| `all_vendors.csv` | All results combined in one CSV |
| `all_vendors.json` | All results combined in JSON |
| `{state}_{category}.csv` | Incremental per-state/category CSV |
| `{state}_{category}.json` | Incremental per-state/category JSON |
| `scraper.log` | Full run log |

---

## Data Collected Per Vendor

| Field | Description |
|-------|-------------|
| `name` | Business name |
| `category` / `subcategory` | Vendor type |
| `profile_url` | TheKnot profile URL |
| `state` / `state_abbr` / `city` / `area` | Location |
| `address` / `zip_code` | Full address |
| `phone` | Phone number |
| `website` | Business website |
| `email` | Contact email (if listed) |
| `instagram` / `facebook` / `pinterest` | Social links |
| `description` | Business bio |
| `starting_price` / `price_range` | Pricing info |
| `rating` / `review_count` | Aggregate reviews |
| `awards` | TheKnot awards/badges |
| `tags` | Style/amenity tags |
| `featured` | Whether they're a featured/premium vendor |

---

## Important Notes

### Legal & Ethical Use
- Always review the site's **Terms of Service** and **robots.txt** before scraping
- TheKnot's ToS restricts automated scraping — use this for **personal research** only
- Do not overload their servers — the built-in delays help with this
- Consider reaching out to TheKnot directly for bulk data or partnership

### Selector Maintenance
TheKnot.com periodically updates its HTML/CSS class names. If the scraper stops finding vendors:
1. Open a vendor listing page in your browser
2. Right-click a vendor card → "Inspect Element"
3. Update the CSS selectors in `parse_listing_page()` and `parse_detail_page()`

### Rate Limiting
If you get blocked (HTTP 429), increase `--delay-min` and `--delay-max`:
```bash
python theknot_scraper.py --state texas --delay-min 3.0 --delay-max 7.0
```

---

## Architecture

```
TheKnotScraper
├── scrape()                  # Main entry point
├── scrape_category_state()   # Scrapes all pages for one state+category
├── parse_listing_page()      # Extracts vendor cards from search results
├── parse_detail_page()       # Fetches full profile (contact, bio, etc.)
├── get_total_pages()         # Reads pagination
└── _save_*()                 # CSV + JSON export
```

The scraper uses:
- **requests** + **BeautifulSoup** for HTML parsing
- **JSON-LD structured data** extraction (most reliable source on modern sites)
- **CSS selector fallbacks** for dynamic content
- **Random user-agent rotation** and request delays to avoid blocks
- **Incremental saving** so data is preserved even if the run is interrupted
