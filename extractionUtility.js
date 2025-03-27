const fs = require('fs');
const path = require('path');

// Configuration
const sourceDir = 'CMS153FHIR-v0.2.000-FHIR4-TestCases';
const destDir = 'input/tests/measure/ChlamydiaScreeninginWomenFHIR';

// Ensure the destination directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir);
}

/**
 * Process a directory containing FHIR bundle files
 */
function processDirectory() {
  // Get all patient directories
  const patientDirs = fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  console.log(`Found ${patientDirs.length} patient directories to process`);

  patientDirs.forEach(patientDir => processPatientDirectory(patientDir));
}

/**
 * Process a single patient directory
 * @param {string} patientDirName - Name of the patient directory
 */
function processPatientDirectory(patientDirName) {
  console.log(`Processing patient directory: ${patientDirName}`);
  
  const patientSourcePath = path.join(sourceDir, patientDirName);
  const patientDestPath = path.join(destDir, patientDirName);
  
  // Create patient directory in destination
  if (!fs.existsSync(patientDestPath)) {
    fs.mkdirSync(patientDestPath);
  }
  
  // Find FHIR bundle file in the source directory
  const files = fs.readdirSync(patientSourcePath);
  const bundleFiles = files.filter(file => file.endsWith('.json'));
  
  if (bundleFiles.length === 0) {
    console.warn(`No bundle file found in ${patientDirName}`);
    return;
  }
  
  // Process each bundle file (typically should be just one)
  bundleFiles.forEach(bundleFile => {
    const bundlePath = path.join(patientSourcePath, bundleFile);
    processBundle(bundlePath, patientDestPath);
  });
}

/**
 * Process a FHIR bundle file
 * @param {string} bundlePath - Path to the bundle file
 * @param {string} destPath - Destination patient directory path
 */
function processBundle(bundlePath, destPath) {
  console.log(`Processing bundle: ${bundlePath}`);
  
  try {
    // Read and parse the bundle
    const bundleContent = fs.readFileSync(bundlePath, 'utf8');
    const bundle = JSON.parse(bundleContent);
    
    if (!bundle.entry || !Array.isArray(bundle.entry)) {
      console.warn(`Bundle at ${bundlePath} has no entries`);
      return;
    }
    
    // Get the bundle ID for later use in Patient note
    const bundleId = bundle.id || `unknown-bundle-${Date.now()}`;
    console.log(`Bundle ID: ${bundleId}`);
    
    // Extract resources by type
    const resourcesByType = {};
    
    bundle.entry.forEach(entry => {
      if (!entry.resource || !entry.resource.resourceType) {
        console.warn('Entry without resource or resourceType found');
        return;
      }
      
      const resourceType = entry.resource.resourceType;
      
      if (!resourcesByType[resourceType]) {
        resourcesByType[resourceType] = [];
      }
      
      // If this is a Patient resource, add the bundle ID as a note
      if (resourceType === 'Patient') {
        // Create a note array if it doesn't exist
        if (!entry.resource.note) {
          entry.resource.note = [];
        }
        
        // Add the bundle ID as a note
        entry.resource.note.push({
          text: bundleId
        });
        
        console.log(`Added bundle ID "${bundleId}" as note to Patient resource`);
      }
      
      resourcesByType[resourceType].push(entry.resource);
    });
    
    // Save resources by type
    Object.entries(resourcesByType).forEach(([resourceType, resources]) => {
      const resourceTypeDir = path.join(destPath, resourceType);
      
      // Create resource type directory if it doesn't exist
      if (!fs.existsSync(resourceTypeDir)) {
        fs.mkdirSync(resourceTypeDir);
      }
      
      // Save each resource as a separate file
      resources.forEach(resource => {
        const resourceId = resource.id || `unknown-${Date.now()}`;
        const resourcePath = path.join(resourceTypeDir, `${resourceId}.json`);
        
        fs.writeFileSync(resourcePath, JSON.stringify(resource, null, 2));
        console.log(`Saved ${resourceType}/${resourceId}`);
      });
    });
    
  } catch (error) {
    console.error(`Error processing bundle ${bundlePath}:`, error);
  }
}

// Start processing
console.log('Starting FHIR bundle extraction');
processDirectory();
console.log('Extraction complete');