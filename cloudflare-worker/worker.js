/**
 * SLS Travel Langkawi - Stripe Checkout Cloudflare Worker
 * 
 * Supports:
 * - Cart flow with multiple vehicle & tour bookings
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
        cartItems = [],
        customerName = '',
        customerPhone = '',
        customerEmail = '',
        successUrl,
        cancelUrl,
        // Fallback for single item format
        vehicleName,
        packageName,
        amount
      } = body;

      // Normalize items into an array
      let itemsToProcess = [];
      if (Array.isArray(cartItems) && cartItems.length > 0) {
        itemsToProcess = cartItems;
      } else if (amount && Number(amount) > 0) {
        itemsToProcess = [{
          vehicleName: vehicleName || 'Luxury Vehicle',
          packageName: packageName || 'Standard Package',
          price: Number(amount),
          pickupDate: body.pickupDate || '',
          pickupDateFormatted: body.pickupDateFormatted || body.pickupDate || '',
          pickupTime: body.pickupTime || '',
          pax: body.pax || '1',
          pickupLocation: body.pickupLocation || '',
          dropoffLocation: body.dropoffLocation || '',
          notes: body.notes || ''
        }];
      }

      if (itemsToProcess.length === 0) {
        return new Response(JSON.stringify({ error: 'Your cart is empty. Please add at least one booking.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Build x-www-form-urlencoded params for Stripe API
      const params = new URLSearchParams();

      // Payment methods: card + fpx
      // Apple Pay and Google Pay appear automatically when 'card' is enabled on supported devices
      params.append('payment_method_types[0]', 'card');
      params.append('payment_method_types[1]', 'fpx');
      params.append('mode', 'payment');

      // Add each cart item as a Stripe line_item
      let totalCalculatedAmount = 0;
      itemsToProcess.forEach((item, index) => {
        const itemPrice = parseFloat(item.price);
        if (isNaN(itemPrice) || itemPrice <= 0) return;

        totalCalculatedAmount += itemPrice;
        const unitAmountInSen = Math.round(itemPrice * 100);

        const vName = item.vehicleName || 'Vehicle';
        const pName = item.packageName || 'Package';
        const dateStr = item.pickupDateFormatted || item.pickupDate || 'Scheduled date';
        const timeStr = item.pickupTime || 'Scheduled time';
        const paxStr = item.pax || '1';
        const pickupStr = item.pickupLocation || 'Langkawi';

        params.append(`line_items[${index}][price_data][currency]`, 'myr');
        params.append(`line_items[${index}][price_data][unit_amount]`, unitAmountInSen.toString());
        params.append(`line_items[${index}][price_data][product_data][name]`, `SLS Langkawi: ${vName} (${pName})`);
        params.append(`line_items[${index}][price_data][product_data][description]`, `Date: ${dateStr} @ ${timeStr} | ${paxStr} Pax | Pickup: ${pickupStr}`);
        params.append(`line_items[${index}][quantity]`, '1');
      });

      if (totalCalculatedAmount <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid total amount in cart.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Customer Email for automatic Stripe Receipt
      if (customerEmail && customerEmail.includes('@')) {
        params.append('customer_email', customerEmail.trim());
      }

      // Metadata stored in Stripe Dashboard
      params.append('metadata[customer_name]', customerName || '');
      params.append('metadata[customer_phone]', customerPhone || '');
      params.append('metadata[items_count]', itemsToProcess.length.toString());

      const itemTitles = itemsToProcess.map(it => `${it.vehicleName} (${it.packageName})`).join(', ');
      params.append('metadata[summary]', itemTitles.substring(0, 490));

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
          error: session.error?.message || 'Error creating Stripe checkout session.'
        }), {
          status: stripeRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        id: session.id,
        url: session.url,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (err) {
      console.error('Server error:', err);
      return new Response(JSON.stringify({ error: err.message || 'Internal server error.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
