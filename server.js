const express = require('express');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const abuseContacts = require('./abuseContacts'); // separate big file

const app = express();
const PORT = process.env.PORT || 3000;

// Global Rate Limiter (5 requests per minute per IP)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
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
  if (n.length === 10) {
    return n.slice(0, 3) + '-' + n.slice(3, 6) + '-' + n.slice(6);
  } else if (n.length === 11 && n.startsWith('1')) {
    return n.slice(1, 4) + '-' + n.slice(4, 7) + '-' + n.slice(7);
  } else {
    return num;
  }
};

const findClosestAbuseContact = (carrierName) => {
  carrierName = carrierName.toLowerCase();
  for (const key in abuseContacts) {
    if (carrierName.includes(key.toLowerCase()) || key.toLowerCase().includes(carrierName)) {
      return abuseContacts[key];
    }
  }
  return [`abuse@${carrierName.replace(/\s/g, '').toLowerCase()}.com`];
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

    let fullNumber = countryCode + sanitizedOffendingNumber.replace(/\D/g, '');

    const lookupResponse = await fetch(`http://apilayer.net/api/validate?access_key=${process.env.NUMVERIFY_API_KEY}&number=${encodeURIComponent(fullNumber)}`);
    const lookupData = await lookupResponse.json();

    const provider = lookupData.carrier || 'Unknown Carrier';
    let abuseEmails = findClosestAbuseContact(provider);

    abuseEmails.push('potentialviolation@usac.org');
    if (isIRSScam === 'on' || isIRSScam === true) {
      abuseEmails.push('phishing@irs.gov');
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

    res.json({
      abuseEmails,
      emailSubject,
      emailBody,
      provider
    });

  } catch (error) {
    console.error('Error preparing report:', error);
    res.status(500).json({ message: "Failed to prepare report." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

