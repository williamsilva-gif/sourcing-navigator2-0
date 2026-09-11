// Adapter for the Navigator Mock OBT portal.
// Contract: login(page, credential) -> void ; search(page, check) -> offer | notFound
// Adapters are strictly READ-ONLY: they navigate, read and screenshot. Never book.

export const key = "mock";
export const version = "1.0.0";

export async function login(page, baseUrl, credential) {
  await page.goto(new URL("/login", baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.fill("#username", credential.username);
  await page.fill("#password", credential.password);
  await Promise.all([page.waitForLoadState("domcontentloaded"), page.click("#login-submit")]);
  if (await page.locator("#login-error").count()) {
    const err = new Error("login rejected by portal");
    err.code = "AUTH_INVALID_CREDENTIALS";
    throw err;
  }
}

export async function search(page, baseUrl, check) {
  const url = new URL("/results", baseUrl);
  url.searchParams.set("hotel", check.hotelName);
  url.searchParams.set("checkin", check.checkIn);
  url.searchParams.set("checkout", check.checkOut);
  url.searchParams.set("adults", String(check.adults ?? 1));
  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });

  if (await page.locator("#no-hotel").count()) {
    return { found: false, hotel_found: false, amenities: [], page_url: page.url() };
  }
  if (await page.locator("#no-rate").count()) {
    return { found: false, hotel_found: true, amenities: [], page_url: page.url() };
  }

  const text = async (field) => (await page.locator(`[data-field="${field}"]`).innerText()).trim();
  const rateRaw = await text("rate");
  const [currency, amount] = rateRaw.split(/\s+/);
  const amenities = (await text("amenities")).split(",").map((a) => a.trim()).filter(Boolean);

  return {
    found: true,
    hotel_found: true,
    hotel_name: await text("hotel"),
    currency,
    rate_amount: Number(amount),
    rate_basis: "per_night",
    number_of_nights: Number(await text("nights")) || check.nights,
    room_type: await text("roomType"),
    rate_plan: await text("ratePlan"),
    rate_code: await text("rateCode"),
    lra: (await text("lra")).toUpperCase() === "LRA",
    taxes_included: (await text("taxes")).toLowerCase().startsWith("inclus"),
    cancellation_text: await text("cancellation"),
    refundable: null,
    amenities,
    raw_text: await page.locator("#offer").innerText(),
    page_url: page.url(),
  };
}
