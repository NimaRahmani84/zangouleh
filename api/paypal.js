const { createClient } = require('@supabase/supabase-js');

const PAYPAL_MODE = process.env.PAYPAL_MODE?.trim() || 'live';
const PAYPAL_BASE = PAYPAL_MODE === 'sandbox'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

function getServiceClient() {
  return createClient(process.env.SUPABASE_URL?.trim(), process.env.SUPABASE_SERVICE_KEY?.trim());
}

async function requireUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;
  const sb = getServiceClient();
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function getPaypalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const sb = getServiceClient();
  const { action, payload = {} } = req.body || {};

  try {
    if (action === 'create-order') {
      const { data: payment, error } = await sb
        .from('payments')
        .select('*')
        .eq('id', payload.paymentId)
        .eq('student_email', user.email)
        .neq('status', 'paid')
        .maybeSingle();
      if (error) throw error;
      if (!payment) return res.status(404).json({ error: 'Payment not found or already paid' });

      const accessToken = await getPaypalAccessToken();
      const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            reference_id: String(payment.id),
            description: `Zangouleh Music School — ${payment.package || 'Tuition'}`,
            amount: { currency_code: 'CAD', value: Number(payment.amount).toFixed(2) }
          }]
        })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.message || 'PayPal order creation failed');
      return res.json({ orderID: orderData.id });
    }

    if (action === 'capture-order') {
      const { data: payment, error } = await sb
        .from('payments')
        .select('*')
        .eq('id', payload.paymentId)
        .eq('student_email', user.email)
        .maybeSingle();
      if (error) throw error;
      if (!payment) return res.status(404).json({ error: 'Payment not found' });

      const accessToken = await getPaypalAccessToken();
      const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${payload.orderID}/capture`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
      });
      const captureData = await captureRes.json();
      if (!captureRes.ok) throw new Error(captureData.message || 'PayPal capture failed');

      const captured = captureData.purchase_units?.[0]?.payments?.captures?.[0];
      const capturedAmount = Number(captured?.amount?.value || 0);
      if (captured?.status !== 'COMPLETED' || Math.abs(capturedAmount - Number(payment.amount)) > 0.01) {
        return res.status(400).json({ error: 'Payment amount mismatch or not completed' });
      }

      await sb.from('payments').update({ status: 'paid' }).eq('id', payment.id);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('[paypal]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
