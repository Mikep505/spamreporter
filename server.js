// Updated server.js with country code input and better reset behavior
const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const abuseContacts = {
    "Verizon Wireless": ["abuse@verizon.com", "security.issues@verizon.com"],
    "TELUS Mobility": ["abuse@telus.com"],
    "Bandwidth": ["support@mybwc.zendesk.com"],
    "Peerless Network": ["report@peerlessnetwork.com"],
    "T-Mobile": ["abuse@t-mobile.com"],
    "TextNow": ["abuse@textnow.com", "abuse@enflick.com"],
    "MagicJack": ["ReportAbuse@magicjack.com"],
    "VoxBeam": ["dids@voxbeam.com", "support@voxbeam.com"],
    "Google Voice": ["support@mybwc.zendesk.com"],
    "Level 3 Communications": ["security.feedback@level3.com", "abuse@level3.com"],
    "YMAX": ["ReportAbuse@magicjack.com"],
    "Twilio": ["stopspam@twilio.com"],
    "Inteliquent": ["abuse@onvoy.com", "abuse@sinch.com"],
    "RingCentral": ["fraudresponse@ringcentral.com"]
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
    messageContent
  } = req.body;

  try {
    let fullNumber = countryCode + offendingNumber.replace(/\D/g, '');

    const lookupResponse = await fetch(`http://apilayer.net/api/validate?access_key=${process.env.NUMVERIFY_API_KEY}&number=${encodeURIComponent(fullNumber)}`);
    const lookupData = await lookupResponse.json();

    const provider = lookupData.carrier || 'Unknown Carrier';

    const abuseEmails = abuseContacts[provider] || [`abuse@${provider.toLowerCase().replace(/\s/g, '')}.com`];

    const emailSubject = `Fraud Operators Using ${provider} Network (${prettyNumber(offendingNumber)})`;
    const emailBody = `
Hello,

Fraudulent scam operation using this number ${prettyNumber(offendingNumber)}.

This ${provider} customer is using your network for Fraud/Scam operations. Please cancel this customer using this line ${prettyNumber(offendingNumber)}, and all lines associated with them.

They texted my number ${prettyNumber(phoneNumber)} at ${time} ${timeZone} on ${date}.
${messageContent ? `Message Content:\n\"${messageContent}\"\n` : ''}
Thank you for your commitment to keeping criminals from using the ${provider} network for their criminal operations.

-${name}
    `.trim();

    res.json({
      abuseEmails,
      emailSubject,
      emailBody,
      provider
    });

  } catch (error) {
    console.error('Error preparing report:', error);
    res.status(500).json({message: "Failed to prepare report."});
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

