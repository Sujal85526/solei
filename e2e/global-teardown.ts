import { adminClient } from "./helpers/auth";

/**
 * Hide what the suite created, once every project has finished. Specs can't do this themselves: an
 * afterAll runs when one worker leaves the file, while other workers and projects still use the
 * rows. Products and locations keep their ledger history, so they are retired, not deleted.
 */
export default async function globalTeardown() {
  const admin = adminClient();
  await admin.from("products").update({ active: false }).like("name", "E2E %");
  await admin.from("stock_locations").update({ active: false }).like("name", "E2E %");
  await admin.from("stock_locations").update({ active: false }).like("name", "POS e2e %");
}
