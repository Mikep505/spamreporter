const express = require('express');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
const twilio = require('twilio');
require('dotenv').config();
const abuseContacts = require('./abuseContacts');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Render
app.set('trust proxy', 1);

// Rate limit middleware
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

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

const normalizeName = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')                 // remove non-alphanumerics
    .replace(/(llc|inc|corp|corporation|ltd|co)$/i, ''); // strip suffixes
};

const findClosestAbuseContact = (carrierName) => {
  const normalizedCarrier = normalizeName(carrierName);
  console.log(`🔍 Normalized input carrier: "${carrierName}" → "${normalizedCarrier}"`);

  for (const key in abuseContacts) {
    const normalizedKey = normalizeName(key);
    console.log(`🆚 Comparing to: "${key}" → "${normalizedKey}"`);

    if (
      normalizedCarrier === normalizedKey ||
      normalizedCarrier.includes(normalizedKey) ||
      normalizedKey.includes(normalizedCarrier)
    ) {
      console.log(`✅ Matched abuse contact: ${key}`);
      return abuseContacts[key];  // Now returns { emails: [...], url: "..." }
    }
  }

  console.warn(`❌ NO MATCH FOUND for: "${carrierName}"`);
  return null;
};


//const findClosestAbuseContact = (carrierName) => {
//const normalizedCarrier = normalizeName(carrierName);
//  for (const key in abuseContacts) {
//    const normalizedKey = normalizeName(key);
//    if (normalizedCarrier === normalizedKey || normalizedCarrier.includes(normalizedKey) || normalizedKey.includes(normalizedCarrier)) {
//      console.log(`✅ Matched abuse contact: ${key}`);
//      return abuseContacts[key];
//    }
//  }
//  console.warn(`❌ NO MATCH FOUND for: "${carrierName}"`);
//  return null;
//};


//const findClosestAbuseContact = (carrierName) => {
//  const normalizedCarrier = normalizeName(carrierName);
//  let bestMatch = null;
//
//  for (const key in abuseContacts) {
//    const normalizedKey = normalizeName(key);
//    if (
//      normalizedCarrier === normalizedKey ||
//      normalizedCarrier.includes(normalizedKey) ||
//      normalizedKey.includes(normalizedCarrier)
//    ) {
//      console.log(`✅ Matched abuse contact: "${key}"`);
//      bestMatch = abuseContacts[key];
//      break;
//    }
//  }
//
//  if (!bestMatch) {
//    console.warn(`❌ NO MATCH FOUND for: "${carrierName}"`);
//  }
//
//  return bestMatch;
//};


app.post('/submit-report', async (req, res) => {
  const {
    name, email, phoneNumber, countryCode, offendingNumber,
    date, time, timeZone, messageContent, isIRSScam
  } = req.body;

  try {
    const sanitizedName = sanitizeInput(name, 100);
    const sanitizedEmail = sanitizeInput(email, 150);
    const sanitizedPhoneNumber = sanitizeInput(phoneNumber, 20);
    const sanitizedOffendingNumber = sanitizeInput(offendingNumber, 20).replace(/\D/g, '');

const rawDate = sanitizeInput(date, 20);  // yyyy-mm-dd
const rawTime = sanitizeInput(time, 20);  // 24h

let formattedDate = rawDate;
let formattedTime = rawTime;

try {
  const isoString = `${rawDate}T${rawTime}`;
  const dateObj = new Date(isoString);

  formattedDate = dateObj.toLocaleDateString('en-US'); // MM/DD/YYYY
  formattedTime = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); // 12-hour format with AM/PM
} catch (e) {
  console.warn('⚠️ Failed to format date/time:', e);
}


    const sanitizedTimeZone = sanitizeInput(timeZone, 20);
    const sanitizedMessageContent = sanitizeInput(messageContent, 2000);

    const fullNumber = countryCode + sanitizedOffendingNumber;
    let provider = 'Unknown Carrier';

    // 1. Try CarrierLookup
    try {
      const clRes = await fetch(`https://www.carrierlookup.com/api/lookup?key=${process.env.CARRIERLOOKUP_API_KEY}&number=${sanitizedOffendingNumber}`);
      const clData = await clRes.json();
      console.log('📦 CarrierLookup raw response:', JSON.stringify(clData, null, 2));
      if (clData?.Response?.carrier) {
        provider = clData.Response.carrier;
        console.log(`✅ Found provider from CarrierLookup: ${provider}`);
      } else {
        throw new Error('No result from CarrierLookup');
      }
    } catch {
      // 2. Fallback to NumVerify
      try {
        const nvRes = await fetch(`http://apilayer.net/api/validate?access_key=${process.env.NUMVERIFY_API_KEY}&number=${encodeURIComponent(fullNumber)}`);
        const nvData = await nvRes.json();
        console.log('📦 NumVerify raw response:', JSON.stringify(nvData, null, 2));
        if (nvData?.carrier) {
          provider = nvData.carrier;
          console.log(`✅ Found provider from NumVerify: ${provider}`);
        } else {
          throw new Error('No result from NumVerify');
        }
      } catch {
        // 3. Fallback to Twilio Lookup
        try {
          const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          const twilioData = await client.lookups.v1.phoneNumbers(fullNumber).fetch({ type: ['carrier'] });
          provider = twilioData.carrier?.name || 'Unknown Carrier';
          console.log('📦 Twilio Lookup response:', JSON.stringify(twilioData, null, 2));
          console.log(`✅ Found provider from Twilio: ${provider}`);
        } catch (twilioError) {
          console.error('❌ All lookups failed.', twilioError);
        }
      }
    }

    const normalized = normalizeName(provider);
    console.log(`Normalizing carrier name: "${provider}" → "${normalized}"`);

let abuseEntry = findClosestAbuseContact(provider);
let abuseEmails = abuseEntry?.emails || null;
let abuseUrl = abuseEntry?.url || null;

if (!abuseEmails && provider && provider.includes(' ')) {
  abuseEmails = [`abuse@${provider.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`];
}


    const ccEmails = ['potentialviolation@usac.org'];
    if (isIRSScam === 'on' || isIRSScam === true) ccEmails.push('phishing@irs.gov');

    const emailSubject = `Fraud Operators Using ${provider} Network (${prettyNumber(sanitizedOffendingNumber)})`;
    const emailBody = `
Hello,

Fraudulent scam operation using this number ${prettyNumber(sanitizedOffendingNumber)}.

This ${provider} customer is using your network for Fraud/Scam operations. Please cancel this customer using this line ${prettyNumber(sanitizedOffendingNumber)}, and all lines associated with them.

They texted my number ${prettyNumber(sanitizedPhoneNumber)} at ${formattedTime} ${sanitizedTimeZone} on ${formattedDate}.

${sanitizedMessageContent ? `Message Content:\n"${sanitizedMessageContent}"\n` : ''}
Thank you for your commitment to keeping criminals from using the ${provider} network for their criminal operations.

-${sanitizedName}
    `.trim();

    res.json({
      abuseEmails,
      ccEmails,
      emailSubject,
      emailBody,
      provider,
      manualAction: !abuseEmails,
      message: abuseEmails ? undefined : `⚠️ No known abuse contact found for "${provider}". Please report manually.`
    });
  } catch (error) {
    console.error('Error preparing report:', error);
    res.status(500).json({ message: 'Failed to prepare report.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

