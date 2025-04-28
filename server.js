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
  "Enflick": ["abuse@enflick.com", "abuse@textnow.com"],
  "TextNow": ["abuse@textnow.com", "abuse@enflick.com"],
  "Google Voice": ["support@mybwc.zendesk.com"],
  "Bandwidth": ["support@mybwc.zendesk.com", "voicesecurity@bandwidth.com"],
  "Localphone 360 Networks SVR": ["dids@voxbeam.com"],
  "MCImetro": ["security.issues@verizon.com", "abuse@verizon.com"],
  "Verizon": ["abuse@verizon.com", "security.issues@verizon.com", "ResearchandCompliance@one.verizon.com", "robert.chirino@verizon.com"],
  "Onvoy": ["regina.echols@inteliquent.com", "abuse@onvoy.com"],
  "Peerless Network": ["report@peerlessnetwork.com", "CourtOrders@subsentio.com", "LELiaison@subsentio.com", "Abuse@subsentio.com", "trouble@peerlessnetwork.com"],
  "T-Mobile": ["Abuse@t-mobile.com", "KeLevine@tracfone.com"],
  "Twilio": ["stopspam@twilio.com", "support@twilio.zendesk.com"],
  "VoxBeam": ["dids@voxbeam.com", "support@voxbeam.com"],
  "MagicJack": ["ReportAbuse@magicjack.com"],
  "YMAX": ["ReportAbuse@magicjack.com"],
  "382 Communications": ["abuse@382com.com", "support@382com.com"],
  "7G Network, Inc": ["abuse@zayo.com", "CanCustomerService@Allstream.com", "UScustomerservice@allstream.com", "support@allstream.com"],
  "800.com": ["support@800.com", "ron@7gnetwork.net"],
  "Advanced Telecom Solutions, LLC": ["support@turbobridge.com"],
  "Aerialink/Geneseo (SVR)": ["support@mybwc.zendesk.com"],
  "Airus": ["report@peerlessnetwork.com", "CourtOrders@subsentio.com", "LELiaison@subsentio.com", "Abuse@subsentio.com", "abuse@peerlessnetwork.com", "trouble@peerlessnetwork.com"],
  "Alcazar Networks": ["johnc@alcazarnetworks.com", "cso@alcazarnetworks.com", "abuse@alcazarnetworks.com"],
  "Allstream Inc.": ["abuse@zayo.com", "CanCustomerService@Allstream.com", "UScustomerservice@allstream.com", "support@allstream.com"],
  "Ameritech Illinois": ["abuse@att.net"],
  "AT&T": ["abuse@att.net"],
  "Astound Broadband": ["customerservice@wavebroadband.com"],
  "Blitz Telecom": ["crm@blitztelus.com", "investigate@blitztelecomservices.com"],
  "Brightlink Communications": ["noc@brightlink.com"],
  "Broadview": ["fraudmailbox@windstream.com"],
  "Broadvox": ["abuse@onvoy.com"], 
  "Callture": ["support@callture.com"],
  "Cavalier Telephone": ["Windstream.NetworkAbuse@Windstream.com"],
  "CenturyLink": ["security.feedback@level3.com", "abuse@level3.com", "abuse@centurylink.com", "support@centurylink.com"],
  "Chatr": ["officeofpresident@chatrmobile.com", "abuse@chatrmobile.com"],
  "Cingular Wireless": ["customerservice@consumercellular.com", "support@consumercellular.com"],
  "Core Communications": ["voipservice@coretel.net", "sales@coretel.net", "abuse@coretel.net", "service@coretel.net"],
  "Coretel": ["voipservice@coretel.net", "sales@coretel.net", "abuse@coretel.net", "service@coretel.net"],
  "CTSI, Inc": ["tammy@ctsioutsourcing.com"],
  "Distributel": ["abuse@distributel.ca", "support@thinktel.ca", "info@distributel.ca", "sales@distributel.ca"],
  "Excel Telecommunications": ["customercare@impacttelecom.com"],
  "Exiant Communications": ["crm@blitztelus.com", "lnp@exiantcom.com"],
  "Fibernetics": ["abuse@fibernetics.ca"],
  "Flowroute Inc": ["subpoenas@flowroute.com", "Westcarrierfraudnotifications@west.com"],
  "GoTextMe": ["abuse@go-text.me"],
  "Grasshopper Group LLC": ["support-replies@logmein.com", "rich.trabucco@logmein.com", "noc@grasshopper.com", "dschiavone@grasshopper.com"],
  "Hypercube Telcom": ["Westcarrierfraudnotifications@west.com"],
  "IDT Corporation": ["gabe.sasso@idt.net"],
  "Immediate Services, LLC": ["support@teli.net", "sales@teli.net", "abuse@teli.net"],
  "Integrated Path Communications, LLC": ["customercare@iristel.com", "abuse@iristel.com", "support@iristel.com", "security@iristel.ca"],
  "Inteliquent": ["regina.echols@inteliquent.com", "abuse@onvoy.com"],
  "ISP Telecom": ["sub-inquiry@isptelecom.net", "marianne@isptelecom.net"],
  "KCINDUR Communications": ["kim@advancedwireless.us", "abuse@advancedwireless.us", "support@advancedwireless.us"],
  "Level 3 Communications": ["security.feedback@level3.com", "abuse@level3.com"],
  "Local Access LLC": ["subpoena@localaccessllc.com", "sales@localaccessllc.com", "report@peerlessnetwork.com"],
  "Navigata": ["connections@navigata.ca", "sales@navigata.ca", "abuse@navigata.ca", "support@navigata.ca"],
  "Neutral Tandem": ["regina.echols@inteliquent.com", "abuse@onvoy.com"],
  "Nuwave Resporg": ["info@nuwave.com", "abuse@nuwave.com", "support@nuwave.com", "abuse@nuwaveresporg.com"],
  "ONCALL Resporg": ["scleland@atlc.com", "support@atlc.zendesk.com"],
  "Pacific Bell": ["abuse@att.net"],
  "Paetec Communications": ["Windstream.NetworkAbuse@Windstream.com"],
  "Plivo": ["abuse@plivo.com", "support@plivo.com"],
  "Primus": ["customer.care@primustel.ca", "support@primustel.ca", "support@primus-wireless.ca"],
  "Qwest": ["abuse@qwest.net"],
  "RingCentral": ["fraudresponse@ringcentral.com", "Fraudalert@ringcentral.com"],
  "Rogers Communications Partnership": ["abuse@rogers.com", "phishing@rogers.com"],
  "Rogers Wireless": ["abuse@rogers.com", "phishing@rogers.com"],
  "Signal One": ["admin@soe01.com"],
  "SIP.US": ["abuse@sip.us", "support@mybwc.zendesk.com", "voicesecurity@bandwidth.com"],
  "Skype/Level 3": ["security.feedback@level3.com", "abuse@level3.com"],
  "Sonic Systems": ["psftech@swbell.net", "abuse@swbell.net"],
  "Southwestern Bell": ["abuse@att.net"],
  "Sprint Spectrum, L.P.": ["abuse@sprint.net", "security@sprint.net"],
  "TC Systems": ["support@tctechsystems.com"],
  "Telengy L.L.C": ["info@telengy.net", "lnp@telengy.net", "noc@telengy.net", "legal@telengy.net", "abuse@telengy.net", "support@telengy.net", "sales@telengy.net"],
  "Teleport Communications America": ["info@teleportone.com", "abuse@teleportone.com", "support@teleportone.com"],
  "Telnyx": ["support@telnyx.com"],
  "TextPlus": ["support@textplus.com", "lawenforcement@textplusteam.com", "abuse@textplus.com", "bishop@textplus.com"],
  "Thinq": ["noc@thinq.com"],
  "TollFreeForwarding.com": ["support@tollfreeforwarding.com"],
  "USA Mobility Wireless, Inc.": ["customer.care@spok.com"],
  "Vonage": ["abuse@vonage.com", "phishing@vonage.com"],
  "ZipWhip": ["supportlist@zipwhip.com", "support@zipwhip.com", "reportabuse@zipwhip.com"],
  "Bell Mobility": ["abuse@bell.ca"]
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

