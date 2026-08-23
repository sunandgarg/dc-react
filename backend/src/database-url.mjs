export function configureDatabaseUrl() {
  if (process.env.DATABASE_URL || !process.env.DB_HOST) return process.env.DATABASE_URL;
  const user = encodeURIComponent(process.env.DB_USER || "dc_admin");
  const password = encodeURIComponent(process.env.DB_PASSWORD || "");
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || "3306";
  const database = encodeURIComponent(process.env.DB_NAME || "dc_react");
  const ssl = process.env.DB_SSL_CA
    ? `?${new URLSearchParams({ sslcert: process.env.DB_SSL_CA, sslaccept: "strict" })}`
    : "";
  process.env.DATABASE_URL = `mysql://${user}:${password}@${host}:${port}/${database}${ssl}`;
  return process.env.DATABASE_URL;
}

configureDatabaseUrl();
