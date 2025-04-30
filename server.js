const express = require('express');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const abuseContacts = require('./abuseContacts');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate Limit: 5 requests per minute
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

app.set('trust proxy', 1);
app.use(limiter);
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Helpers
const sanitizeInput = (input, maxLength = 500) => {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>"']/g, '').substring(0, maxLength).trim();
};

const prettyNumber = (num) => {
  const n = num.replace(/\D/g, '');
  if (n.length === 10) return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;
  if (n.length === 11 && n.startsWith('1')) return `${n.slice(1, 4)}-${n.slice(4, 7)}-${n.slice(7)}`;
  return num;
};

const normalizeName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const findClosestAbuseContact = (carrierName) => {
  const normalizedCarrier = normalizeName(carrierName);
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const key in abuseContacts) {
    const normalizedKey = normalizeName(key);
    if (normalizedCarrier === normalizedKey) return abuseContacts[key];
    const dist = levenshtein(normalizedCarrier, normalizedKey);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = key;
    }
  }

  if (bestDistance <= 3) {
    console.log(`✅ Approximate match found: ${bestMatch}`);
    return abuseContacts[bestMatch];
  }

  console.log(`❌ NO MATCH FOUND for: "${carrierName}"`);
  return null;
};

const levenshtein = (a, b) => {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return matrix[a.length][b.length];
};

app.post('/submit-report', async (req, res) => {
  const {
    name, email, phoneNumber, countryCode, offendingNumber,
    date, time, timeZone, messageContent, isIRSScam
  } = req.body;

  try {
    const sanitized = {
      name: sanitizeInput(name, 100),
      email: sanitizeInput(email, 150),
      phoneNumber: sanitizeInput(phoneNumber, 20),
      offendingNumber: sanitizeInput(offendingNumber, 20),
      date: sanitizeInput(date, 20),
      time: sanitizeInput(time, 20),
      timeZone: sanitizeInput(timeZone, 20),
      messageContent: sanitizeInput(messageContent, 2000)
    };

    const cleanOffendingNumber = sanitized.offendingNumber.replace(/\D/g, '');
    const fullNumber = countryCode + cleanOffendingNumber;
    let provider = 'Unknown Carrier';

    // Lookup with CarrierLookup
    try {
      const clRes = await fetch(`https://www.carrierlookup.com/api/lookup?key=${process.env.CARRIERLOOKUP_API_KEY}&number=${encodeURIComponent(cleanOffendingNumber)}`);
      const clData = await clRes.json();
      console.log('📦 CarrierLookup raw response:', JSON.stringify(clData, null, 2));
      if (clData?.Response?.carrier) {
        provider = clData.Response.carrier;
        console.log(`✅ Found provider from CarrierLookup: ${provider}`);
      }
    } catch {}

    // Fallback to NumVerify
    if (provider === 'Unknown Carrier') {
      try {
        const nvRes = await fetch(`http://apilayer.net/api/validate?access_key=${process.env.NUMVERIFY_API_KEY}&number=${encodeURIComponent(fullNumber)}`);
        const nvData = await nvRes.json();
        console.log('📦 NumVerify raw response:', JSON.stringify(nvData, null, 2));
        if (nvData?.carrier) {
          provider = nvData.carrier;
          console.log(`✅ Found provider from NumVerify: ${provider}`);
        }
      } catch {}
    }

    // Fallback to Twilio Lookup
    if (provider === 'Unknown Carrier') {
      try {
        const twilioRes = await fetch(`https://lookups.twilio.com/v1/PhoneNumbers/${encodeURIComponent(fullNumber)}?Type=carrier`, {
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${process.env.TWILIO_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
          }
        });
        const twilioData = await twilioRes.json();
        console.log('📦 Twilio Lookup response:', JSON.stringify(twilioData, null, 2));
        if (twilioData?.carrier?.name) {
          provider = twilioData.carrier.name;
          console.log(`✅ Found provider from Twilio: ${provider}`);
        }
      } catch (e) {
        console.error('❌ Twilio lookup failed:', e);
      }
    }

    const normalizedProvider = normalizeName(provider);
    console.log(`Normalizing carrier name: "${provider}" → "${normalizedProvider}"`);
    const abuseEmails = findClosestAbuseContact(provider);

    const ccEmails = ['potentialviolation@usac.org'];
    if (isIRSScam === 'on' || isIRSScam === true) ccEmails.push('phishing@irs.gov');

    const emailSubject = `Fraud Operators Using ${provider} Network (${prettyNumber(sanitized.offendingNumber)})`;
    const emailBody = `Hello,

Fraudulent scam operation using this number ${prettyNumber(sanitized.offendingNumber)}.

This ${provider} customer is using your network for Fraud/Scam operations. Please cancel this customer using this line ${prettyNumber(sanitized.offendingNumber)}, and all lines associated with them.

They texted my number ${prettyNumber(sanitized.phoneNumber)} at ${sanitized.time} ${sanitized.timeZone} on ${sanitized.date}.
${sanitized.messageContent ? `Message Content:\n\"${sanitized.messageContent}\"\n` : ''}Thank you for your commitment to keeping criminals from using the ${provider} network for their criminal operations.

-${sanitized.name}`;

    if (!abuseEmails) {
      return res.json({
        abuseEmails: [],
        ccEmails,
        emailSubject,
        emailBody,
        provider,
        manualAction: true,
        message: `No known abuse contact found for "${provider}". Please report manually.`
      });
    }

    res.json({
      abuseEmails,
      ccEmails,
      emailSubject,
      emailBody,
      provider,
      manualAction: false
    });

  } catch (error) {
    console.error('Error preparing report:', error);
    res.status(500).json({ message: "Failed to prepare report." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

