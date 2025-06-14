/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://suviplay.com',
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/' },
      // Add any specific disallow rules here if needed beyond sitemap exclusion
      // For example, if you want to explicitly tell bots not to crawl certain API patterns
      // { userAgent: '*', disallow: '/api/' }, 
    ],
    // The Sitemap directive is automatically added by next-sitemap
  },
  exclude: [
    // Admin panel
    '/admin',
    '/admin/*',
    // Dynamic game/utility routes not meant for direct SEO indexing
    '/room',
    '/room/*',
    '/join', // Excludes the base /join if you want, but usually it's fine to keep
    '/join/*',
    '/referral',
    '/referral/*',
    // Default next-sitemap exclusion for its server-side sitemap functionality
    '/server-sitemap.xml',
    // API routes (good practice, though Next.js often handles this)
    '/api/*',
  ],
  // Optional: Default priority and changefreq are usually fine.
  // priority: 0.7,
  // changefreq: 'daily',
};
