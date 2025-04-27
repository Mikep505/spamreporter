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
    "Verizon": ["abuse@verizon.com", "security.issues@verizon.com"],
    "Bandwidth": ["support@mybwc.zendesk.com"],
    "Onvoy": ["regina.echols@inteliquent.com", "abuse@onvoy.com"],
    "Peerless Network": ["report@peerlessnetwork.com"],
    "Twilio": ["stopspam@twilio.com"],
    "TextNow": ["abuse@textnow.com", "abuse@enflick.com"],
    "MagicJack": ["ReportAbuse@magicjack.com"],
    "T-Mobile": ["abuse@t-mobile.com"],
    "VoxBeam": ["dids@voxbeam.com", "support@voxbeam.com"],
    "Google Voice": ["support@mybwc.zendesk.com"],
    "Level 3 Communications": ["security.feedback@level3.com", "abuse@level3.com"],
    "YMAX": ["ReportAbuse@magicjack.com"],
    "Inteliquent": ["regina.echols@inteliquent.com", "abuse@onvoy.com"],
    "Neutral Tandem": ["regina.echols@inteliquent.com", "abuse@onvoy.com"],
    "RingCentral": ["fraudresponse@ringcentral.com"],
};

app.post('/submit-report', async (req, res) => {
    const {
        name,
        email,
        phoneNumber,
        offendingNumber,
        date,
        time,
        timeZone,
        messageContent
    } = req.body;

    try {
        const lookupResponse = await fetch(`https://www.carrierlookup.com/api/lookup?key=${process.env.CARRIERLOOKUP_API_KEY}&number=${encodeURIComponent(offendingNumber)}`);
        const lookupData = await lookupResponse.json();
        
        const provider = lookupData.Response?.carrier || 'Unknown Carrier';
        const normalizedProvider = provider.trim();

        const abuseEmails = abuseContacts[normalizedProvider] || [`abuse@${normalizedProvider.toLowerCase().replace(/\\s/g, '')}.com`];

        const emailSubject = `Fraud Operators Using ${normalizedProvider} Network (${offendingNumber})`;
        const emailBody = `
Hello,

Fraudulent scam operation using this number ${offendingNumber}.

This ${normalizedProvider} customer is using your network for Fraud/Scam operations. Please cancel this customer using this line ${offendingNumber}, and all lines associated with them.

They texted my number ${phoneNumber} at ${time} ${timeZone} on ${date}.

${messageContent ? `Message Content:\\n\\"${messageContent}\\"\\n` : ''}

Thank you for your commitment to keeping criminals from using the ${normalizedProvider} network for their criminal operations.

-${name}
        `.trim();

        res.json({
            abuseEmails,
            emailSubject,
            emailBody,
            provider: normalizedProvider
        });
    } catch (error) {
        console.error('Error preparing report:', error);
        res.status(500).json({message: "Failed to prepare report."});
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

