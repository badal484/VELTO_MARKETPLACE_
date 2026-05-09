require('dotenv').config();
const str = process.env.FIREBASE_SERVICE_ACCOUNT;
console.log('Raw length:', str ? str.length : 'NULL');

const safeParse = (str) => {
  if (!str) return null;
  // Step 1: Normalize the string. If it's single-quoted in .env, dotenv might keep the quotes or have issues.
  // Step 2: Handle literal newlines inside the JSON string values.
  let cleaned = str.trim();
  
  // Remove wrapping single quotes if present
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.log('Initial parse failed, attempting robust fix...');
    
    // The issue is likely literal newlines in the private_key field
    // We need to escape them
    try {
      // Strategy: Replace all actual newlines with \n
      const escaped = cleaned.replace(/\n/g, '\\n');
      return JSON.parse(escaped);
    } catch (e2) {
      console.log('Robust fix failed:', e2.message);
      
      // Last resort: regex to find the private_key and escape ONLY its content
      try {
        const pkFixed = cleaned.replace(/"private_key":\s*"([\s\S]*?)"/, (match, p1) => {
          return `"private_key": "${p1.replace(/\n/g, '\\n')}"`;
        });
        return JSON.parse(pkFixed);
      } catch (e3) {
        console.log('Regex fix failed:', e3.message);
        return null;
      }
    }
  }
};

const parsed = safeParse(str);
if (parsed) {
  console.log('Success! Project ID:', parsed.project_id);
} else {
  console.log('Failed to parse FIREBASE_SERVICE_ACCOUNT');
}
