/**
 * SLS Travel Langkawi - Stripe Checkout Cloudflare Worker
 * 
 * Supports:
 * - Credit / Debit Cards (Visa, Mastercard, Amex, UnionPay)
 * - FPX Online Banking (All Malaysian banks via Stripe FPX)
 * - Apple Pay & Google Pay (automatically displayed on supported devices)
 * 
 * Setup:
 * 1. Deploy this worker to Cloudflare Workers (100% Free).
 * 2. In Cloudflare Worker Settings -> Variables -> Add Secret:
 *    Name: STRIPE_SECRET_KEY
 *    Value: sk_live_... (or sk_test_... for testing)
 * 3. Copy the Worker URL into index.html (STRIPE_CONFIG.checkoutEndpoint).
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Health check endpoint
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'SLS Travel Langkawi - Stripe Checkout API',
        configured: Boolean(env.STRIPE_SECRET_KEY)
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const stripeSecretKey = env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        return new Response(JSON.stringify({
          error: 'STRIPE_SECRET_KEY is not configured in Cloudflare Worker environment variables.'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await request.json();
      const {
        vehicleName = 'Luxury Vehicle',
        vehicleModel = '',
        packageName = 'Standard Package',
        packageType = 'transfer',
        amount,
        customerName = '',
        customerPhone = '',
        customerEmail = '',
        pickupDate = '',
        pickupDateFormatted = '',
        pickupTime = '',
        pax = '1',
        pickupLocation = '',
        dropoffLocation = '',
        notes = '',
        successUrl,
        cancelUrl,
      } = body;

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return new Response(JSON.stringify({ error: 'Jumlah pembayaran tidak sah (Invalid amount).' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Convert MYR amount to sen / cents (e.g., RM 150 -> 15000 sen)
      const unitAmountInSen = Math.round(numAmount * 100);

      // Build x-www-form-urlencoded params for Stripe API
      const params = new URLSearchParams();

      // Payment methods: card + fpx
      // Apple Pay and Google Pay appear automatically when 'card' is enabled on supported devices
      params.append('payment_method_types[0]', 'card');
      params.append('payment_method_types[1]', 'fpx');
      params.append('mode', 'payment');

      // Product and pricing details
      const itemName = `SLS Langkawi: ${vehicleName} (${packageName})`;
      const itemDesc = `Tarikh: ${pickupDateFormatted || pickupDate} | Masa: ${pickupTime} | Penumpang: ${pax} Pax | Ambil: ${pickupLocation}`;

      params.append('line_items[0][price_data][currency]', 'myr');
      params.append('line_items[0][price_data][unit_amount]', unitAmountInSen.toString());
      params.append('line_items[0][price_data][product_data][name]', itemName);
      params.append('line_items[0][price_data][product_data][description]', itemDesc);
      params.append('line_items[0][quantity]', '1');

      // Customer Email for automatic Stripe Receipt
      if (customerEmail && customerEmail.includes('@')) {
        params.append('customer_email', customerEmail.trim());
      }

      // Detailed metadata visible in Stripe Dashboard
      params.append('metadata[customer_name]', customerName);
      params.append('metadata[customer_phone]', customerPhone);
      params.append('metadata[vehicle]', vehicleName);
      params.append('metadata[model]', vehicleModel);
      params.append('metadata[package]', packageName);
      params.append('metadata[package_type]', packageType);
      params.append('metadata[pickup_date]', pickupDate);
      params.append('metadata[pickup_time]', pickupTime);
      params.append('metadata[pax]', pax);
      params.append('metadata[pickup_location]', pickupLocation);
      params.append('metadata[dropoff_location]', dropoffLocation || '-');
      params.append('metadata[notes]', notes || '-');

      // Success & Cancel URLs
      const origin = request.headers.get('origin') || 'https://saifullangkawiservice.com';
      const finalSuccessUrl = successUrl || `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`;
      const finalCancelUrl = cancelUrl || `${origin}/?payment=cancelled`;

      params.append('success_url', finalSuccessUrl);
      params.append('cancel_url', finalCancelUrl);

      // Call Stripe API
      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const session = await stripeRes.json();

      if (!stripeRes.ok) {
        console.error('Stripe API error:', session);
        return new Response(JSON.stringify({
          error: session.error?.message || 'Ralat semasa membuat sesi pembayaran Stripe.'
        }), {
          status: stripeRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Return session id and Stripe checkout redirect URL
      return new Response(JSON.stringify({
        id: session.id,
        url: session.url,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (err) {
      console.error('Server error:', err);
      return new Response(JSON.stringify({ error: err.message || 'Ralat pelayan dalaman.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
