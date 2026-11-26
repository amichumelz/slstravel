# 💳 Stripe Setup Guide — SLS Travel Langkawi
*(Credit/Debit Cards, FPX Online Banking & Apple Pay with Cart Flow)*

Your website is equipped with official **Stripe Checkout** integrated with a streamlined **Add to Cart & Checkout** flow, supporting:
- 💳 **Credit & Debit Cards** (Visa, Mastercard, American Express, UnionPay)
- 🏦 **FPX Online Banking** (All Malaysian banks: Maybank2u, CIMB Clicks, Public Bank, RHB, Hong Leong, Bank Islam, etc.)
-  **Apple Pay** (Automatically displayed for Safari users on iPhone, iPad, and Mac)
- 🤖 **Google Pay** (Automatically displayed on supported Android and Chrome devices)

---

## ⚡ Step 1: Enable Payment Methods in your Stripe Dashboard

1. Log in to your Stripe account at **[dashboard.stripe.com](https://dashboard.stripe.com/)**.
2. Navigate to **Settings** ➡️ **Payment methods** (or visit `dashboard.stripe.com/settings/payment_methods`).
3. Ensure the following payment methods are set to **"Active"**:
   - **Cards** (Visa, Mastercard) ➡️ *Active*
   - **FPX** (Malaysian Online Banking) ➡️ *Active* (Click *Turn on* if not yet enabled)
   - **Apple Pay** ➡️ *Active* (Apple Pay uses the card rails and is automatically handled by Stripe Checkout)

---

## 🔑 Step 2: Retrieve Your Stripe Secret Key

1. In the Stripe Dashboard, click the **Developers** tab (top right) ➡️ **API keys**.
2. Locate your keys:
   - **Publishable key** (`pk_live_...` or `pk_test_...`)
   - **Secret key** (`sk_live_...` or `sk_test_...`)
3. Copy your **Secret key** (`sk_live_...`). *(Keep this secret safe; never expose secret keys in client-side HTML or public scripts).*

> 💡 **Tip:** You can use your test secret key (`sk_test_...`) first to perform test bookings without charging real money.

---

## 🚀 Step 3: Deploy the Serverless Endpoint (Cloudflare Workers — 100% Free)

Because GitHub Pages hosts static files only, Stripe requires a lightweight serverless function to securely initiate checkout sessions without exposing your Secret Key.

The ready-to-deploy script is provided in [`cloudflare-worker/worker.js`](file:///Users/fatinshamirah/website%20sls/cloudflare-worker/worker.js).

### Quick Deployment via Cloudflare Dashboard (Takes 2 Minutes)
1. Go to **[dash.cloudflare.com](https://dash.cloudflare.com/)** (Create a free account if you don't have one).
2. Go to **Workers & Pages** in the left sidebar ➡️ Click **Create application** ➡️ Select **Create Worker**.
3. Choose a name (e.g., `sls-stripe-checkout`) ➡️ Click **Deploy**.
4. Once deployed, click **Edit code**:
   - Clear any existing template code in the online editor.
   - Copy all contents of [`cloudflare-worker/worker.js`](file:///Users/fatinshamirah/website%20sls/cloudflare-worker/worker.js) and paste them into the editor.
   - Click **Deploy** (top right).
5. Add your Stripe Secret Key:
   - Go back to the Worker's overview page (click the Worker name at the top).
   - Go to **Settings** ➡️ **Variables and Secrets**.
   - Under **Variables and Secrets**, click **Add**.
   - Type: **Secret**
   - Variable name: `STRIPE_SECRET_KEY`
   - Value: Paste your Stripe Secret Key (`sk_live_...` or `sk_test_...`).
   - Click **Deploy** / **Save**.
6. Copy your Worker URL:
   - Copy the public endpoint displayed on the Worker overview page (e.g., `https://sls-stripe-checkout.your-subdomain.workers.dev`).

---

## 🔗 Step 4: Add Your Worker URL to `index.html`

1. Open [`index.html`](file:///Users/fatinshamirah/website%20sls/index.html).
2. Find the Stripe configuration object near line ~3050:
```javascript
const STRIPE_CONFIG = {
  // Replace with your live Cloudflare Worker URL:
  checkoutEndpoint: 'https://sls-stripe-checkout.your-subdomain.workers.dev',
};
```
3. Replace the placeholder URL with your actual Cloudflare Worker URL.
4. Save `index.html`.

---

## 🛒 How the "Add to Cart First, Then Payment" Flow Works

1. **Browse & Configure**: The customer views the fleet and clicks **"Reserve"** on a vehicle (e.g. Toyota Vellfire).
2. **Add to Cart**: In the modal, they pick their package, date, time, passengers, and pickup location, then click **"Add to Cart"**.
3. **Review Cart**: The luxury Cart Drawer opens smoothly on the right, listing all configured rides with details, pricing, and remove buttons.
4. **Multi-Ride Booking**: Customers can click **"Add Another Ride or Tour"** to add return transfers, additional vehicles, or island tours into the same cart.
5. **Secure Checkout**: Inside the cart, they enter their name, phone, and email, then click **"Pay RM [Total] with Stripe"**.
6. **Payment & Receipt**: Stripe Checkout securely handles Cards, FPX Online Banking, or Apple Pay.
7. **Instant Confirmation**: After successful payment, the customer is redirected to the confirmation screen with their Stripe reference, official receipt email, and a one-click WhatsApp button to alert their chauffeur.

---

## ❓ FAQ

### 1. Does Stripe charge transaction fees in Malaysia?
Standard Stripe Malaysia pricing:
- Local cards: 3% + RM 1.00 per successful charge
- International cards: 4% + RM 1.00 per successful charge
- FPX Online Banking: ~RM 1.00 or 1.5%

### 2. When are payouts deposited into my bank account?
Stripe automatically deposits funds into your connected Malaysian bank account on a rolling 2–3 business day schedule.
