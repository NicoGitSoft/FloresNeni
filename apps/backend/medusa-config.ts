import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const webpayEnabled = process.env.WEBPAY_ENABLED !== "false"

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,

    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },

  modules: [
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: webpayEnabled
          ? [
              {
                resolve: "./src/modules/webpay",
                id: "webpay",
                options: {
                  environment:
                    process.env.WEBPAY_ENVIRONMENT ?? "integration",
                  commerce_code: process.env.WEBPAY_COMMERCE_CODE,
                  api_key: process.env.WEBPAY_API_KEY,
                  return_url:
                    process.env.WEBPAY_RETURN_URL ??
                    "http://localhost:9000/webpay/return",
                },
              },
            ]
          : [],
      },
    },
  ],
})
