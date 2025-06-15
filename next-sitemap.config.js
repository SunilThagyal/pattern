/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://suviplay.com',
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [
      {
        userAgent: 'Googlebot',
        allow: [
          '/',
          '/create-room',
          '/join',         // Allow the static /join page
          '/auth',
          '/how-to-earn',
        ],
        disallow: [
          '/admin/',      // Disallow admin section for Googlebot
          '/room/',       // Disallow all game rooms for Googlebot
          '/join/',       // Disallow anything deeper under /join (e.g., /join/[roomId]) for Googlebot
          '/referral/',   // Disallow referral redirect pages for Googlebot
          '/api/',        // Disallow API routes for Googlebot
        ],
      },
      {
        userAgent: '*', // For all other bots
        disallow: ['/'], // Disallow everything
      },
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
    // Static /join page IS included in sitemap (not in exclude)
    '/join/*', // Excludes /join/[roomId] etc. from sitemap
    '/referral',
    '/referral/*',
    // Default next-sitemap exclusion for its server-side sitemap functionality
    '/server-sitemap.xml',
    // API routes
    '/api/*',
  ],
};
