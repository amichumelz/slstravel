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
      error: 'STRIPE_SECRET_KEY is not configured in environment variables.'
    });
  }

  try {
    const {
      cartItems = [],
      customerName = '',
      customerPhone = '',
      customerEmail = '',
      successUrl,
      cancelUrl,
      vehicleName,
      packageName,
      amount
    } = req.body || {};

    let itemsToProcess = [];
    if (Array.isArray(cartItems) && cartItems.length > 0) {
      itemsToProcess = cartItems;
    } else if (amount && Number(amount) > 0) {
      itemsToProcess = [{
        vehicleName: vehicleName || 'Luxury Vehicle',
        packageName: packageName || 'Standard Package',
        price: Number(amount),
        pickupDate: req.body.pickupDate || '',
        pickupDateFormatted: req.body.pickupDateFormatted || req.body.pickupDate || '',
        pickupTime: req.body.pickupTime || '',
        pax: req.body.pax || '1',
        pickupLocation: req.body.pickupLocation || '',
        dropoffLocation: req.body.dropoffLocation || '',
        notes: req.body.notes || ''
      }];
    }

    if (itemsToProcess.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty. Please add at least one booking.' });
    }

    const params = new URLSearchParams();
    params.append('payment_method_types[0]', 'card');
    params.append('payment_method_types[1]', 'fpx');
    params.append('mode', 'payment');

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
      return res.status(400).json({ error: 'Invalid total amount in cart.' });
    }

    if (customerEmail && customerEmail.includes('@')) {
      params.append('customer_email', customerEmail.trim());
    }

    params.append('metadata[customer_name]', customerName || '');
    params.append('metadata[customer_phone]', customerPhone || '');
    params.append('metadata[items_count]', itemsToProcess.length.toString());

    const itemTitles = itemsToProcess.map(it => `${it.vehicleName} (${it.packageName})`).join(', ');
    params.append('metadata[summary]', itemTitles.substring(0, 490));

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
        error: session.error?.message || 'Error creating Stripe checkout session.'
      });
    }

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
}
