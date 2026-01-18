const ANALYTICS_URL = process.env.ANALYTICS_URL || "http://analytics:8004";

module.exports = {
    async rewrites() {
        return [
            {
                source: "/api/:path*",
                destination: `${ANALYTICS_URL}/:path*`,
            },
        ];
    },
};
