import { isAgricultureRelated } from './nlp';
import * as cheerio from 'cheerio';

export interface Env {
  agrinews_db: D1Database;
  ASSETS: Fetcher;
}

export default {
  /**
   * 1. THE WEB API (Replaces Flask app.py)
   * This handles browser requests (e.g., when you visit your site).
   */

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/api/scrape') {
                // Call the scheduled event to force a scrape
                await this.scheduled({} as ScheduledEvent, env, ctx);
                return new Response("Scraping triggered manually!");
        }

	// 1. Handle API requests (Replaces your Flask home() route logic)
	if (url.pathname === '/api/news') {
		const query = url.searchParams.get('query');
		let results;
		
		if (query) {
		// Search logic
		results = await env.agrinews_db.prepare(
			"SELECT * FROM articles WHERE headline LIKE ? OR description LIKE ? ORDER BY id DESC"
		).bind(`%${query}%`, `%${query}%`).all();
		} else {
		// Default latest news
		results = await env.agrinews_db.prepare("SELECT * FROM articles ORDER BY id DESC LIMIT 50").all();
		}
		
		return new Response(JSON.stringify(results.results), {
		headers: { "Content-Type": "application/json;charset=UTF-8" }
		});
	}

	// 2. Handle Static Assets (Serves your index.html and style.css)
	// This uses the ASSETS binding we just added to the Env interface
	return env.ASSETS.fetch(request);
	},

  /**
   * 2. THE SCRAPER ENGINE (Replaces scrapper.py & APScheduler)
   * This runs automatically every 3 minutes based on your wrangler config.
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Your 4 target websites from original requirements
    const sources = [
      { name: 'Ratopati', url: 'https://ratopati.com/category/news', selector: '.columnnews' },
      { name: 'OnlineKhabar', url: 'https://onlinekhabar.com/content/news', selector: '.ok-news-post' },
      { name: 'SancharKendra', url: 'https://sancharkendra.com/archives/category/news', selector: '.skcatpg' },
      { name: 'KrishiDaily', url: 'https://krishidaily.com/category/news', selector: '.td_module_wrap' }
    ];

    for (const site of sources) {
      try {
        const response = await fetch(site.url);
        const html = await response.text();
        const $ = cheerio.load(html);

        const scrapedArticles: any[] = [];

        $(site.selector).each((_, el) => {
          const headline = $(el).find('h2, h3, h4').text().trim();
          const link = $(el).find('a').attr('href');
          let image_url = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || null;
          
          // Use your ported NLP logic
          if (headline && isAgricultureRelated(headline)) {
            scrapedArticles.push({
              headline,
              article_url: link || site.url,
              image_url,
              source: site.name
            });
          }
        });

        // Save to D1 Database
        // "INSERT OR IGNORE" prevents duplicate headlines just like your original SQL logic
        if (scrapedArticles.length > 0) {
          const stmt = env.agrinews_db.prepare(
            "INSERT OR IGNORE INTO articles (headline, article_url, image_url, source) VALUES (?, ?, ?, ?)"
          );

          await env.agrinews_db.batch(
            scrapedArticles.map(a => stmt.bind(a.headline, a.article_url, a.image_url, a.source))
          );
        }
      } catch (e) {
        console.error(`Failed to scrape ${site.name}:`, e);
      }
    }
  }
};