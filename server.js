const express = require('express');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const abuseContactsRaw = require('./abuseContacts'); // Load raw

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Sanitize inputs
const sanitizeInput = (input, maxLength = 500) => {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>"']/g, '').substring(0, maxLength).trim();
};

// Normalize carrier names
const normalizeName = (name) => {
  return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
};

// Build a normalized contacts lookup
const abuseContacts = {};
for (const carrier in abuseContactsRaw) {
  abuseContacts[normalizeName(carrier)] = abuseContactsRaw[carrier];
}

// Find best abuse contact
const findClosestAbuseContact = (carrierName) => {
  const normalizedCarrier = normalizeName(carrierName);

  if (abuseContacts[normalizedCarrier]) {
    return abuseContacts[normalizedCarrier];
  }

  // Fuzzy fallback
  for (const key in abuseContacts) {
    if (normalizedCarrier.includes(key) || key.includes(normalizedCarrier)) {
      return abuseContacts[key];
    }
  }

  return null;
};

// POST route
app.post('/submit-report', async (req, res) => {
  const {
    name, email, phoneNumber, countryCode,
    offendingNumber, date, time, timeZone,
    messageContent, isIRSScam
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
      const carrierLookupResponse = await fetch(`https://www.carrierlookup.com/api/lookup?key=${process.env.CARRIERLOOKUP_API_KEY}&number=${encodeURIComponent(cleanOffendingNumber)}`);
      const carrierLookupData = await carrierLookupResponse.json();

      console.log('📦 CarrierLookup raw response:', JSON.stringify(carrierLookupData, null, 2));

      if (carrierLookupData?.Response?.carrier) {
        provider = carrierLookupData.Response.carrier;
        console.log(`✅ Found provider from CarrierLookup: ${provider}`);
      } else {
        console.warn('⚠️ CarrierLookup failed, trying NumVerify...');

        const numverifyResponse = await fetch(`http://apilayer.net/api/validate?access_key=${process.env.NUMVERIFY_API_KEY}&number=${encodeURIComponent(fullNumber)}`);
        const numverifyData = await numverifyResponse.json();

        console.log('📦 NumVerify raw response:', JSON.stringify(numverifyData, null, 2));

        if (numverifyData?.carrier) {
          provider = numverifyData.carrier;
          console.log(`✅ Found provider from NumVerify: ${provider}`);
        }
      }
    } catch (lookupError) {
      console.error('❌ Lookup error:', lookupError);
    }

    console.log(`Normalizing carrier name: "${provider}" → "${normalizeName(provider)}"`);

    const abuseEmails = findClosestAbuseContact(provider);
    console.log('Abuse contact found:', abuseEmails || 'None');

    const ccEmails = ['potentialviolation@usac.org'];
    if (isIRSScam === 'on' || isIRSScam === true) {
      ccEmails.push('phishing@irs.gov');
    }

    const emailSubject = `Fraud Operators Using ${provider} Network (${cleanOffendingNumber})`;

    const emailBody = `
Hello,

Fraudulent scam operation using this number ${cleanOffendingNumber}.

This ${provider} customer is using your network for Fraud/Scam operations. Please cancel this customer using this line ${cleanOffendingNumber}, and all lines associated with them.

They texted my number ${sanitizedPhoneNumber} at ${sanitizedTime} ${sanitizedTimeZone} on ${sanitizedDate}.
${sanitizedMessageContent ? `Message Content:\n"${sanitizedMessageContent}"` : ''}

Thank you for your commitment to keeping criminals from using the ${provider} network.

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
    res.status(500).json({ message: 'Failed to prepare report.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

