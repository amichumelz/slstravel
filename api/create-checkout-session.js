/**
 * Vercel Serverless Function - Stripe Checkout Session
 * Endpoint: /api/create-checkout-session
 */

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'SLS Travel Langkawi Stripe API' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return res.status(500).json({
      error: 'STRIPE_SECRET_KEY is not configured in Vercel Environment Variables.'
    });
  }

  try {
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
    } = req.body || {};

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Jumlah pembayaran tidak sah.' });
    }

    const unitAmountInSen = Math.round(numAmount * 100);

    const params = new URLSearchParams();
    params.append('payment_method_types[0]', 'card');
    params.append('payment_method_types[1]', 'fpx');
    params.append('mode', 'payment');

    const itemName = `SLS Langkawi: ${vehicleName} (${packageName})`;
    const itemDesc = `Tarikh: ${pickupDateFormatted || pickupDate} | Masa: ${pickupTime} | Penumpang: ${pax} Pax | Ambil: ${pickupLocation}`;

    params.append('line_items[0][price_data][currency]', 'myr');
    params.append('line_items[0][price_data][unit_amount]', unitAmountInSen.toString());
    params.append('line_items[0][price_data][product_data][name]', itemName);
    params.append('line_items[0][price_data][product_data][description]', itemDesc);
    params.append('line_items[0][quantity]', '1');

    if (customerEmail && customerEmail.includes('@')) {
      params.append('customer_email', customerEmail.trim());
    }

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

    const host = req.headers.host || 'saifullangkawiservice.com';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const defaultOrigin = `${proto}://${host}`;

    params.append('success_url', successUrl || `${defaultOrigin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', cancelUrl || `${defaultOrigin}/?payment=cancelled`);

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
      return res.status(stripeRes.status).json({
        error: session.error?.message || 'Ralat semasa membuat sesi pembayaran Stripe.'
      });
    }

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Ralat pelayan dalaman.' });
  }
}
