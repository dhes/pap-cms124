const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Inline CQL content - replace this with your CQL or make it read from a file
const cqlContent = `
valueset "Chlamydia Screening": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.110.12.1052'
valueset "Complications of Pregnancy, Childbirth and the Puerperium": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.111.12.1012'
valueset "Contraceptive Medications": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.196.12.1080'
valueset "Diagnoses Used to Indicate Sexual Activity": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.111.12.1018'
valueset "Diagnostic Studies During Pregnancy": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.111.12.1008'
valueset "HIV": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.120.12.1003'
valueset "Home Healthcare Services": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.101.12.1016'
valueset "Isotretinoin": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.196.12.1143'
valueset "Lab Tests During Pregnancy": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.111.12.1007'
valueset "Lab Tests for Sexually Transmitted Infections": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.110.12.1051'
valueset "Office Visit": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.101.12.1001'
valueset "Virtual Encounter": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.101.12.1089'
valueset "Pap Test": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.108.12.1017'
valueset "Pregnancy Test": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.111.12.1011'
valueset "Preventive Care Services Established Office Visit, 18 and Up": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.101.12.1025'
valueset "Preventive Care Services Initial Office Visit, 18 and Up": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.101.12.1023'
valueset "Preventive Care Services, Initial Office Visit, 0 to 17": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.101.12.1022'
valueset "Preventive Care, Established Office Visit, 0 to 17": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.101.12.1024'
valueset "Procedures Used to Indicate Sexual Activity": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.111.12.1017'
valueset "Telephone Visits": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.101.12.1080'
valueset "XRay Study": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.198.12.1034'
valueset "Encounter Inpatient": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.666.5.307'
valueset "Hospice Care Ambulatory": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.1584'
valueset "Hospice Encounter": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.1003'
valueset "Hospice Diagnosis": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.1165'
valueset "Ethnicity": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.114222.4.11.837'
valueset "ONC Administrative Sex": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113762.1.4.1'
valueset "Payer Type": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.114222.4.11.3591'
valueset "Race": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.114222.4.11.836'
`;

/**
 * Parse CQL valuesets into a structured array
 * @param {string} cqlContent - The CQL content containing valueset declarations
 * @returns {Array} Array of valueset objects
 */
function parseCQLValueSets(cqlContent) {
  const valuesets = [];
  
  // Match valueset declarations in CQL
  // Regex pattern looks for: valueset "Name": 'URL'
  const valuesetPattern = /valueset\s+"([^"]+)":\s+'([^']+)'/g;
  
  let match;
  while ((match = valuesetPattern.exec(cqlContent)) !== null) {
    const display = match[1].trim();
    const resource = match[2].trim();
    
    valuesets.push({
      display: display,
      resource: resource
    });
  }
  
  return valuesets;
}

/**
 * Extract OID from ValueSet URL
 */
function extractOid(url) {
  return url.substring(url.lastIndexOf("/") + 1);
}

/**
 * Login to UMLS and download ValueSets using Puppeteer
 */
async function downloadValueSets(valueSets, apiKey, overwriteExisting = false) {
  console.log(`Starting download of ${valueSets.length} ValueSets...`);
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: "new", // Use new headless mode
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // First visit the login page
    console.log("Visiting UMLS login page...");
    await page.goto('https://cts.nlm.nih.gov/fhir/', { waitUntil: 'networkidle2' });
    
    // Check if login form exists
    const loginFormExists = await page.evaluate(() => {
      return !!document.querySelector('form[action="login"]');
    });
    
    if (loginFormExists) {
      // Fill in the API key
      console.log("Filling in API key...");
      await page.type('input[name="password"]', apiKey);
      
      // Click login button
      console.log("Logging in...");
      await Promise.all([
        page.click('#btnLogin'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);
      
      console.log("Login completed. Checking authentication status...");
      
      // Check if we're logged in by looking for login form
      const stillOnLoginPage = await page.evaluate(() => {
        return !!document.querySelector('form[action="login"]');
      });
      
      if (stillOnLoginPage) {
        console.error("Login appears to have failed. Still on login page.");
        throw new Error("Authentication failed");
      }
    } else {
      console.log("No login form found. Proceeding without login.");
    }
    
    // Process each ValueSet
    let downloaded = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const valueSet of valueSets) {
      const oid = extractOid(valueSet.resource);
      const outputPath = path.join(outputDir, `${oid}.json`);
      
      // Skip if file exists and we're not overwriting
      if (fs.existsSync(outputPath) && !overwriteExisting) {
        console.log(`File already exists: ${outputPath} - Skipping`);
        skipped++;
        continue;
      }
      
      try {
        console.log(`Downloading ValueSet: ${valueSet.display} (${oid})`);
        
        // Go to the JSON URL directly
        const jsonUrl = `${valueSet.resource.replace('http://', 'https://')}/$expand?_format=json`;
        console.log(`Navigating to: ${jsonUrl}`);
        
        const response = await page.goto(jsonUrl, { waitUntil: 'networkidle2' });
        
        // Check if we got a JSON response
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json') || contentType.includes('application/fhir')) {
          // Extract the JSON from the page
          const jsonData = await page.evaluate(() => {
            try {
              // Try to get the pre text content if available
              const preElement = document.querySelector('pre');
              if (preElement) {
                return preElement.textContent;
              }
              // Otherwise get the body text
              return document.body.innerText;
            } catch (e) {
              return document.body.innerText;
            }
          });
          
          // Parse the JSON to validate it
          try {
            const valueSetData = JSON.parse(jsonData);
            
            // Verify it's a ValueSet
            if (valueSetData && valueSetData.resourceType === 'ValueSet') {
              // Save the JSON file
              fs.writeFileSync(outputPath, JSON.stringify(valueSetData, null, 2));
              console.log(`Successfully saved: ${outputPath}`);
              downloaded++;
            } else {
              console.error(`Response doesn't appear to be a ValueSet: ${oid}`);
              fs.writeFileSync(
                path.join(outputDir, `${oid}_error.json`), 
                JSON.stringify(valueSetData, null, 2)
              );
              failed++;
            }
          } catch (parseError) {
            console.error(`Error parsing JSON for ${oid}:`, parseError.message);
            fs.writeFileSync(path.join(outputDir, `${oid}_error.txt`), jsonData);
            failed++;
          }
        } else {
          console.error(`Did not receive JSON for ${oid}. Content-Type: ${contentType}`);
          // Save the HTML response for debugging
          const htmlContent = await page.content();
          fs.writeFileSync(path.join(outputDir, `${oid}_error.html`), htmlContent);
          failed++;
        }
      } catch (error) {
        console.error(`Error downloading ${oid}:`, error.message);
        failed++;
      }
      
      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`
ValueSet processing complete:
- Total: ${valueSets.length}
- Downloaded: ${downloaded}
- Skipped: ${skipped}
- Failed: ${failed}
    `);
    
  } finally {
    await browser.close();
  }
}

// Create output directory
const outputDir = path.join("input", "vocabulary", "valueset", "external");
fs.mkdirSync(outputDir, { recursive: true });

// Main function
async function main() {
  const apiKey = "2f4b6638-ee67-4ad2-9090-5fe8137a9b8d"; // Your API key
  const args = process.argv.slice(2);
  const overwriteFlag = args.includes("--overwrite") || args.includes("-o");
  
  try {
    // Parse the valuesets from the inline CQL
    const valueSets = parseCQLValueSets(cqlContent);
    
    console.log(`Found ${valueSets.length} ValueSets in the CQL content`);
    if (valueSets.length === 0) {
      console.error("No ValueSets found in the CQL content");
      process.exit(1);
    }
    
    // Download the valuesets
    await downloadValueSets(valueSets, apiKey, overwriteFlag);
    
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// Run the script
main();