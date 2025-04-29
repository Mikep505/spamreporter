const express = require('express');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const abuseContacts = require('./abuseContacts'); // Carrier contacts

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxies (needed for Render)
app.set('trust proxy', 1);

// Rate Limit: 5 requests per minute
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Helper to sanitize user inputs
const sanitizeInput = (input, maxLength = 500) => {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>"']/g, '').substring(0, maxLength).trim();
};

// Helper to format phone numbers nicely
const prettyNumber = (num) => {
  const n = num.replace(/\D/g, '');
  if (n.length === 10) {
    return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;
  } else if (n.length === 11 && n.startsWith('1')) {
    return `${n.slice(1, 4)}-${n.slice(4, 7)}-${n.slice(7)}`;
  } else {
    return num;
  }
};

// Normalize carrier names for comparison
const normalizeName = (name) => {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

// Find best abuse contact based on carrier name
const findClosestAbuseContact = (carrierName) => {
  const normalizedCarrier = normalizeName(carrierName);

  let bestMatch = null;
  let shortestDistance = Infinity;

  for (const key in abuseContacts) {
    const normalizedKey = normalizeName(key);

    if (normalizedCarrier === normalizedKey) {
      console.log(`🎯 PERFECT MATCH: "${key}"`);
      return abuseContacts[key];
    }

    if (normalizedCarrier.includes(normalizedKey) || normalizedKey.includes(normalizedCarrier)) {
      const distance = Math.abs(normalizedCarrier.length - normalizedKey.length);
      if (distance < shortestDistance) {
        shortestDistance = distance;
        bestMatch = key;
      }
    }
  }

  if (bestMatch) {
    console.log(`✅ BEST NEAR MATCH: "${bestMatch}"`);
    return abuseContacts[bestMatch];
  }

  console.log(`❌ NO MATCH FOUND for: "${carrierName}"`);
  return null;
};

app.post('/submit-report', async (req, res) => {
  const {
    name,
    email,
    phoneNumber,
    countryCode,
    offendingNumber,
    date,
    time,
    timeZone,
    messageContent,
    isIRSScam
  } = req.body;

  try {
    const sanitizedName = sanitizeInput(name, 100);
    const sanitizedEmail = sanitizeInput(email, 150);
    const sanitizedPhoneNumber = sanitizeInput(phoneNumber, 20);
    const sanitizedOffendingNumber = sanitizeInput(offendingNumber, 20);
    const sanitizedDate = sanitizeInput(date, 20);
    const sanitizedTime = sanitizeInput(time, 20);
    const sanitizedTimeZone = sanitizeInput(timeZone, 20);
    const sanitizedMessageContent = sanitizeInput(messageContent, 2000);

    const cleanOffendingNumber = sanitizedOffendingNumber.replace(/\D/g, '');
    const fullNumber = countryCode + cleanOffendingNumber;

    let provider = 'Unknown Carrier';

    try {
      // CarrierLookup first
      const carrierLookupResponse = await fetch(`https://www.carrierlookup.com/api/lookup?key=${process.env.CARRIERLOOKUP_API_KEY}&number=${encodeURIComponent(cleanOffendingNumber)}`);
      const carrierLookupData = await carrierLookupResponse.json();

      console.log('📦 CarrierLookup raw response:', JSON.stringify(carrierLookupData, null, 2));

      if (carrierLookupData?.Response?.carrier) {
        provider = carrierLookupData.Response.carrier;
        console.log(`✅ Found provider from CarrierLookup: ${provider}`);
      } else {
        console.warn('⚠️ CarrierLookup failed, trying NumVerify...');

        // NumVerify fallback
        const numverifyResponse = await fetch(`http://apilayer.net/api/validate?access_key=${process.env.NUMVERIFY_API_KEY}&number=${encodeURIComponent(fullNumber)}`);
        const numverifyData = await numverifyResponse.json();

        console.log('📦 NumVerify raw response:', JSON.stringify(numverifyData, null, 2));

        if (numverifyData?.carrier) {
          provider = numverifyData.carrier;
          console.log(`✅ Found provider from NumVerify: ${provider}`);
        } else {
          console.error('❌ Both CarrierLookup and NumVerify failed.');
        }
      }
    } catch (lookupError) {
      console.error('❌ Lookup error:', lookupError);
    }

    console.log(`Normalizing carrier name: "${provider}" → "${normalizeName(provider)}"`);

    let abuseEmails = findClosestAbuseContact(provider);

    console.log(`Carrier lookup result: ${provider}`);
    console.log(`Abuse contact found:`, abuseEmails || 'None');

    const ccEmails = ['potentialviolation@usac.org'];
    if (isIRSScam === 'on' || isIRSScam === true) {
      ccEmails.push('phishing@irs.gov');
    }

    const emailSubject = `Fraud Operators Using ${provider} Network (${prettyNumber(sanitizedOffendingNumber)})`;

    const emailBody = `
Hello,

Fraudulent scam operation using this number ${prettyNumber(sanitizedOffendingNumber)}.

This ${provider} customer is using your network for Fraud/Scam operations. Please cancel this customer using this line ${prettyNumber(sanitizedOffendingNumber)}, and all lines associated with them.

They texted my number ${prettyNumber(sanitizedPhoneNumber)} at ${sanitizedTime} ${sanitizedTimeZone} on ${sanitizedDate}.
${sanitizedMessageContent ? `Message Content:\n"${sanitizedMessageContent}"\n` : ''}

Thank you for your commitment to keeping criminals from using the ${provider} network for their criminal operations.

-${sanitizedName}
    `.trim();

    if (!abuseEmails) {
      return res.json({
        abuseEmails: [],
        ccEmails,
        emailSubject,
        emailBody,
        provider,
        manualAction: true,
        message: `⚠️ No known abuse contact found for "${provider}". Please report manually.`
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

