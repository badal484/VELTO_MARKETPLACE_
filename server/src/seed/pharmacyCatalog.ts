import { MedicineForm } from '@shared/types';

/**
 * Seed data for the Velto Pharmacy Catalog.
 * Prices are based on NPPA (National Pharmaceutical Pricing Authority) MRP.
 * All medicines here are OTC (Over The Counter) — no prescription required.
 * Prescription medicines are tagged separately and require Rx upload at checkout.
 *
 * Search terms include: generic name, brand aliases, common symptoms, Hindi names
 * so buyers can search naturally ("bukhar ki dawa", "acidity tablet", etc.)
 */
export const pharmacySeedData = [

  // ── PAIN & FEVER ─────────────────────────────────────────────────────────
  {
    name: 'Paracetamol 500mg Tablet', brand: 'Crocin', genericName: 'Paracetamol',
    strength: '500mg', form: MedicineForm.TABLET, mrp: 25, requiresPrescription: false,
    searchTerms: ['paracetamol','crocin','calpol','fever','headache','pain','bukhar','sir dard','temperature'],
  },
  {
    name: 'Paracetamol 650mg Tablet', brand: 'Dolo', genericName: 'Paracetamol',
    strength: '650mg', form: MedicineForm.TABLET, mrp: 30, requiresPrescription: false,
    searchTerms: ['dolo','paracetamol 650','fever','high fever','headache','bukhar'],
  },
  {
    name: 'Paracetamol 125mg Syrup 60ml', brand: 'Crocin', genericName: 'Paracetamol',
    strength: '125mg/5ml', form: MedicineForm.SYRUP, mrp: 45, requiresPrescription: false,
    searchTerms: ['paracetamol syrup','crocin syrup','child fever','baby fever','bachche ka bukhar'],
  },
  {
    name: 'Ibuprofen 400mg Tablet', brand: 'Brufen', genericName: 'Ibuprofen',
    strength: '400mg', form: MedicineForm.TABLET, mrp: 30, requiresPrescription: false,
    searchTerms: ['brufen','ibuprofen','pain relief','muscle pain','back pain','period pain'],
  },
  {
    name: 'Diclofenac 50mg Tablet', brand: 'Voveran', genericName: 'Diclofenac',
    strength: '50mg', form: MedicineForm.TABLET, mrp: 35, requiresPrescription: false,
    searchTerms: ['voveran','diclofenac','joint pain','arthritis','back pain','sprain'],
  },
  {
    name: 'Combiflam Tablet', brand: 'Combiflam', genericName: 'Ibuprofen + Paracetamol',
    strength: '400mg+325mg', form: MedicineForm.TABLET, mrp: 40, requiresPrescription: false,
    searchTerms: ['combiflam','ibuprofen paracetamol','fever pain','bodyache','dard bukhar'],
  },
  {
    name: 'Aspirin 75mg Tablet', brand: 'Disprin', genericName: 'Aspirin',
    strength: '75mg', form: MedicineForm.TABLET, mrp: 20, requiresPrescription: false,
    searchTerms: ['aspirin','disprin','headache','blood thinner','heart'],
  },
  {
    name: 'Mefenamic Acid 250mg Tablet', brand: 'Meftal Spas', genericName: 'Mefenamic Acid',
    strength: '250mg', form: MedicineForm.TABLET, mrp: 35, requiresPrescription: false,
    searchTerms: ['meftal','mefenamic','period pain','cramps','stomach cramps','masik dard'],
  },

  // ── COLD, COUGH & ALLERGY ────────────────────────────────────────────────
  {
    name: 'Cetirizine 10mg Tablet', brand: 'Zyrtec', genericName: 'Cetirizine',
    strength: '10mg', form: MedicineForm.TABLET, mrp: 25, requiresPrescription: false,
    searchTerms: ['cetirizine','zyrtec','cetzine','allergy','sneezing','runny nose','itching','khujli'],
  },
  {
    name: 'Levocetirizine 5mg Tablet', brand: 'Levocet', genericName: 'Levocetirizine',
    strength: '5mg', form: MedicineForm.TABLET, mrp: 30, requiresPrescription: false,
    searchTerms: ['levocetirizine','levocet','allergy','sneezing','dust allergy','urticaria'],
  },
  {
    name: 'Montelukast 10mg Tablet', brand: 'Montair', genericName: 'Montelukast',
    strength: '10mg', form: MedicineForm.TABLET, mrp: 95, requiresPrescription: false,
    searchTerms: ['montair','montelukast','asthma','allergy','breathing','saans'],
  },
  {
    name: 'Montelukast + Levocetirizine Tablet', brand: 'Montair LC', genericName: 'Montelukast + Levocetirizine',
    strength: '10mg+5mg', form: MedicineForm.TABLET, mrp: 110, requiresPrescription: false,
    searchTerms: ['montair lc','montelukast levocetirizine','allergy cough','cold allergy'],
  },
  {
    name: 'Diphenhydramine Cough Syrup 100ml', brand: 'Benadryl', genericName: 'Diphenhydramine',
    strength: '14.08mg/5ml', form: MedicineForm.SYRUP, mrp: 95, requiresPrescription: false,
    searchTerms: ['benadryl','cough syrup','khansi','dry cough','night cough'],
  },
  {
    name: 'Dextromethorphan Cough Syrup 100ml', brand: 'Corex D', genericName: 'Dextromethorphan',
    strength: '10mg/5ml', form: MedicineForm.SYRUP, mrp: 85, requiresPrescription: false,
    searchTerms: ['corex d','dextromethorphan','dry cough','cough relief','khansi'],
  },
  {
    name: 'Ambroxol 30mg Syrup 100ml', brand: 'Ambrodil', genericName: 'Ambroxol',
    strength: '30mg/5ml', form: MedicineForm.SYRUP, mrp: 65, requiresPrescription: false,
    searchTerms: ['ambroxol','ambrodil','chesty cough','mucus','khansi balgam'],
  },
  {
    name: 'Phenylephrine + Cetirizine Tablet', brand: 'Cheston Cold', genericName: 'Phenylephrine + Cetirizine',
    strength: '5mg+5mg', form: MedicineForm.TABLET, mrp: 45, requiresPrescription: false,
    searchTerms: ['cheston cold','cold tablet','sardi','runny nose','blocked nose','nasal congestion'],
  },
  {
    name: 'Nasal Decongestant Spray 10ml', brand: 'Nasivion', genericName: 'Oxymetazoline',
    strength: '0.05%', form: MedicineForm.DROPS, mrp: 65, requiresPrescription: false,
    searchTerms: ['nasivion','nasal spray','blocked nose','sinus','nasal congestion','naak band'],
  },
  {
    name: 'Chlorpheniramine 4mg Tablet', brand: 'Piriton', genericName: 'Chlorpheniramine',
    strength: '4mg', form: MedicineForm.TABLET, mrp: 20, requiresPrescription: false,
    searchTerms: ['piriton','chlorpheniramine','allergy','itching','hives','urticaria','khujli'],
  },

  // ── ANTACIDS & DIGESTION ─────────────────────────────────────────────────
  {
    name: 'Pantoprazole 40mg Tablet', brand: 'Pan-D', genericName: 'Pantoprazole',
    strength: '40mg', form: MedicineForm.TABLET, mrp: 65, requiresPrescription: false,
    searchTerms: ['pan d','pantoprazole','acidity','gas','heartburn','peptic ulcer','pet dard'],
  },
  {
    name: 'Omeprazole 20mg Capsule', brand: 'Omez', genericName: 'Omeprazole',
    strength: '20mg', form: MedicineForm.CAPSULE, mrp: 55, requiresPrescription: false,
    searchTerms: ['omez','omeprazole','acidity','gastric','hyperacidity','jalan'],
  },
  {
    name: 'Rabeprazole 20mg Tablet', brand: 'Razo', genericName: 'Rabeprazole',
    strength: '20mg', form: MedicineForm.TABLET, mrp: 70, requiresPrescription: false,
    searchTerms: ['razo','rabeprazole','acidity','gastric reflux','acid reflux'],
  },
  {
    name: 'Antacid Gel 170ml', brand: 'Digene', genericName: 'Magaldrate + Simethicone',
    strength: '480mg+20mg/5ml', form: MedicineForm.SYRUP, mrp: 95, requiresPrescription: false,
    searchTerms: ['digene','antacid','acidity','gas','bloating','indigestion','afara','pet gas'],
  },
  {
    name: 'Antacid Gel Mint 170ml', brand: 'Gelusil', genericName: 'Aluminium Hydroxide + Simethicone',
    strength: '250mg+25mg/5ml', form: MedicineForm.SYRUP, mrp: 75, requiresPrescription: false,
    searchTerms: ['gelusil','antacid gel','acidity','gas relief','heartburn'],
  },
  {
    name: 'Domperidone 10mg Tablet', brand: 'Vomistop', genericName: 'Domperidone',
    strength: '10mg', form: MedicineForm.TABLET, mrp: 35, requiresPrescription: false,
    searchTerms: ['vomistop','domperidone','nausea','vomiting','ulti','motion sickness'],
  },
  {
    name: 'Ondansetron 4mg Tablet', brand: 'Emeset', genericName: 'Ondansetron',
    strength: '4mg', form: MedicineForm.TABLET, mrp: 45, requiresPrescription: false,
    searchTerms: ['emeset','ondansetron','vomiting','nausea','ulti','morning sickness'],
  },
  {
    name: 'Simethicone 40mg Tablet', brand: 'Gas-O-Fast', genericName: 'Simethicone',
    strength: '40mg', form: MedicineForm.TABLET, mrp: 30, requiresPrescription: false,
    searchTerms: ['gas o fast','simethicone','gas','bloating','flatulence','afara','pet phulna'],
  },
  {
    name: 'Lactulose Syrup 100ml', brand: 'Duphalac', genericName: 'Lactulose',
    strength: '3.35g/5ml', form: MedicineForm.SYRUP, mrp: 110, requiresPrescription: false,
    searchTerms: ['duphalac','lactulose','constipation','kabz','hard stool','bowel movement'],
  },
  {
    name: 'Isabgol Husk Powder 100g', brand: 'Sat Isabgol', genericName: 'Psyllium Husk',
    strength: '3.5g/5g', form: MedicineForm.POWDER, mrp: 65, requiresPrescription: false,
    searchTerms: ['isabgol','psyllium husk','constipation','kabz','digestion','fiber'],
  },
  {
    name: 'ORS Sachet Orange', brand: 'Electral', genericName: 'ORS',
    strength: '21.8g/sachet', form: MedicineForm.POWDER, mrp: 15, requiresPrescription: false,
    searchTerms: ['electral','ors','dehydration','diarrhea','dast','vomiting','electrolyte'],
  },
  {
    name: 'ORS Sachet Unflavoured', brand: 'WHO-ORS', genericName: 'ORS',
    strength: '21.8g/sachet', form: MedicineForm.POWDER, mrp: 12, requiresPrescription: false,
    searchTerms: ['ors','oral rehydration','dehydration','diarrhea','loose motion','dast'],
  },

  // ── VITAMINS & SUPPLEMENTS ───────────────────────────────────────────────
  {
    name: 'Vitamin C 500mg Tablet', brand: 'Limcee', genericName: 'Ascorbic Acid',
    strength: '500mg', form: MedicineForm.TABLET, mrp: 35, requiresPrescription: false,
    searchTerms: ['limcee','vitamin c','ascorbic acid','immunity','orange tablet','vitamins'],
  },
  {
    name: 'Vitamin D3 60000 IU Capsule', brand: 'D3 Must', genericName: 'Cholecalciferol',
    strength: '60000 IU', form: MedicineForm.CAPSULE, mrp: 55, requiresPrescription: false,
    searchTerms: ['vitamin d3','d3 must','cholecalciferol','bone pain','calcium deficiency'],
  },
  {
    name: 'Multivitamin Capsule', brand: 'Revital H', genericName: 'Multivitamin + Ginseng',
    strength: 'Standard', form: MedicineForm.CAPSULE, mrp: 145, requiresPrescription: false,
    searchTerms: ['revital','multivitamin','energy','fatigue','weakness','kamzori','daily vitamin'],
  },
  {
    name: 'B-Complex Capsule', brand: 'Becosules', genericName: 'Vitamin B Complex',
    strength: 'Standard', form: MedicineForm.CAPSULE, mrp: 95, requiresPrescription: false,
    searchTerms: ['becosules','b complex','vitamin b','mouth ulcer','hair fall','weakness'],
  },
  {
    name: 'Zinc 50mg Tablet', brand: 'Zincovit', genericName: 'Zinc Sulphate',
    strength: '50mg', form: MedicineForm.TABLET, mrp: 65, requiresPrescription: false,
    searchTerms: ['zincovit','zinc','immunity','hair loss','skin','wound healing'],
  },
  {
    name: 'Iron + Folic Acid Tablet', brand: 'Ferrous Folic', genericName: 'Ferrous Sulphate + Folic Acid',
    strength: '200mg+0.5mg', form: MedicineForm.TABLET, mrp: 30, requiresPrescription: false,
    searchTerms: ['iron folic','ferrous','anaemia','anemia','khoon ki kami','pregnancy','folic acid'],
  },
  {
    name: 'Calcium + Vitamin D3 Tablet', brand: 'Shelcal', genericName: 'Calcium Carbonate + Vitamin D3',
    strength: '500mg+250IU', form: MedicineForm.TABLET, mrp: 85, requiresPrescription: false,
    searchTerms: ['shelcal','calcium','bone health','osteoporosis','joint pain','haddi dard'],
  },
  {
    name: 'Omega-3 Fish Oil Capsule', brand: 'Cardipro', genericName: 'Omega-3 Fatty Acids',
    strength: '1000mg', form: MedicineForm.CAPSULE, mrp: 120, requiresPrescription: false,
    searchTerms: ['omega 3','fish oil','heart health','cholesterol','joints','brain'],
  },

  // ── SKIN & TOPICAL ───────────────────────────────────────────────────────
  {
    name: 'Povidone Iodine Ointment 20g', brand: 'Betadine', genericName: 'Povidone Iodine',
    strength: '5%', form: MedicineForm.CREAM, mrp: 55, requiresPrescription: false,
    searchTerms: ['betadine','iodine ointment','wound','cut','antiseptic','ghav','zekhm'],
  },
  {
    name: 'Silver Sulphadiazine Cream 25g', brand: 'Soframycin', genericName: 'Framycetin',
    strength: '1%', form: MedicineForm.CREAM, mrp: 65, requiresPrescription: false,
    searchTerms: ['soframycin','framycetin','burn','wound healing','infection','jalana','jalan'],
  },
  {
    name: 'Burn Ointment 20g', brand: 'Burnol', genericName: 'Tannic Acid + Boric Acid',
    strength: 'Standard', form: MedicineForm.CREAM, mrp: 45, requiresPrescription: false,
    searchTerms: ['burnol','burn cream','jalan','burn treatment','fire burn'],
  },
  {
    name: 'Clotrimazole Cream 30g', brand: 'Candid', genericName: 'Clotrimazole',
    strength: '1%', form: MedicineForm.CREAM, mrp: 75, requiresPrescription: false,
    searchTerms: ['candid','clotrimazole','fungal','ring worm','daad','khujli','athlete foot'],
  },
  {
    name: 'Hydrocortisone Cream 30g', brand: 'Hydrocortisone', genericName: 'Hydrocortisone',
    strength: '1%', form: MedicineForm.CREAM, mrp: 55, requiresPrescription: false,
    searchTerms: ['hydrocortisone','steroid cream','eczema','rash','inflammation','skin allergy'],
  },
  {
    name: 'Mupirocin Ointment 5g', brand: 'T-Bact', genericName: 'Mupirocin',
    strength: '2%', form: MedicineForm.CREAM, mrp: 85, requiresPrescription: false,
    searchTerms: ['t bact','mupirocin','skin infection','impetigo','boil','wound infection'],
  },
  {
    name: 'Calamine Lotion 100ml', brand: 'Lacto Calamine', genericName: 'Calamine',
    strength: '8%', form: MedicineForm.OTHER, mrp: 95, requiresPrescription: false,
    searchTerms: ['calamine lotion','lacto calamine','prickly heat','sunburn','rash','skin soothing'],
  },
  {
    name: 'Diclofenac Gel 30g', brand: 'Voveran Gel', genericName: 'Diclofenac',
    strength: '1%', form: MedicineForm.CREAM, mrp: 65, requiresPrescription: false,
    searchTerms: ['voveran gel','diclofenac gel','pain gel','muscle pain','joint pain','sprain'],
  },
  {
    name: 'Methyl Salicylate Ointment 50g', brand: 'Iodex', genericName: 'Methyl Salicylate',
    strength: '30%', form: MedicineForm.CREAM, mrp: 75, requiresPrescription: false,
    searchTerms: ['iodex','pain balm','body pain','muscle pain','joint pain','backache','dard'],
  },
  {
    name: 'Moisturising Lotion 200ml', brand: 'Cetaphil', genericName: 'Moisturiser',
    strength: 'Standard', form: MedicineForm.OTHER, mrp: 285, requiresPrescription: false,
    searchTerms: ['cetaphil','moisturiser','dry skin','eczema','sensitive skin','moisturizer'],
  },

  // ── EYE & EAR DROPS ─────────────────────────────────────────────────────
  {
    name: 'Sodium Chloride Eye Drops 10ml', brand: 'Eye Washes', genericName: 'Sodium Chloride',
    strength: '0.9%', form: MedicineForm.DROPS, mrp: 35, requiresPrescription: false,
    searchTerms: ['eye drops','saline','eye wash','eye irritation','aankh dard','eye redness'],
  },
  {
    name: 'Carboxy Methyl Cellulose Eye Drops 10ml', brand: 'Refresh Tears', genericName: 'CMC',
    strength: '0.5%', form: MedicineForm.DROPS, mrp: 85, requiresPrescription: false,
    searchTerms: ['refresh tears','lubricant eye drops','dry eyes','computer eye','screen fatigue'],
  },
  {
    name: 'Ear Wax Removal Drops 10ml', brand: 'Waxolve', genericName: 'Hydrogen Peroxide',
    strength: '3%', form: MedicineForm.DROPS, mrp: 55, requiresPrescription: false,
    searchTerms: ['waxolve','ear drops','ear wax','kaan','hearing blocked','ear cleaning'],
  },
  {
    name: 'Ciprofloxacin Eye Drops 5ml', brand: 'Ciplox', genericName: 'Ciprofloxacin',
    strength: '0.3%', form: MedicineForm.DROPS, mrp: 45, requiresPrescription: false,
    searchTerms: ['ciplox','eye drops','conjunctivitis','pink eye','aankh lal','eye infection'],
  },

  // ── DIABETES & BP MONITORING (DEVICES) ──────────────────────────────────
  {
    name: 'Blood Glucose Test Strip (25 strips)', brand: 'AccuChek Active', genericName: 'Glucose Test Strip',
    strength: 'N/A', form: MedicineForm.DEVICE, mrp: 295, requiresPrescription: false,
    searchTerms: ['accu chek','glucometer strip','blood sugar','diabetes','sugar test','madhumeh'],
  },
  {
    name: 'Blood Glucose Test Strip (50 strips)', brand: 'OneTouch Select', genericName: 'Glucose Test Strip',
    strength: 'N/A', form: MedicineForm.DEVICE, mrp: 545, requiresPrescription: false,
    searchTerms: ['onetouch','glucose strip','blood sugar strip','diabetes strip','sugar test strip'],
  },
  {
    name: 'Digital Thermometer', brand: 'Dr. Morepen', genericName: 'Digital Thermometer',
    strength: 'N/A', form: MedicineForm.DEVICE, mrp: 145, requiresPrescription: false,
    searchTerms: ['thermometer','fever check','temperature','digital thermometer','body temperature'],
  },
  {
    name: 'Pulse Oximeter', brand: 'BPL Medical', genericName: 'Pulse Oximeter',
    strength: 'N/A', form: MedicineForm.DEVICE, mrp: 595, requiresPrescription: false,
    searchTerms: ['pulse oximeter','oxygen level','spo2','oxygen saturation','breathing monitor'],
  },
  {
    name: 'BP Monitoring Strips (Compatible)', brand: 'Omron', genericName: 'Blood Pressure Cuff',
    strength: 'N/A', form: MedicineForm.DEVICE, mrp: 895, requiresPrescription: false,
    searchTerms: ['bp machine','blood pressure monitor','bp check','omron','hypertension','bp apparatus'],
  },

  // ── FIRST AID ───────────────────────────────────────────────────────────
  {
    name: 'Crepe Bandage 4-inch', brand: 'Elastoplast', genericName: 'Crepe Bandage',
    strength: '4 inch', form: MedicineForm.OTHER, mrp: 45, requiresPrescription: false,
    searchTerms: ['crepe bandage','bandage','sprain','ankle support','wrist support','patty'],
  },
  {
    name: 'Adhesive Bandage Strip (10 strips)', brand: 'Band-Aid', genericName: 'Adhesive Bandage',
    strength: 'Standard', form: MedicineForm.OTHER, mrp: 35, requiresPrescription: false,
    searchTerms: ['band aid','bandaid','plaster','cut','wound cover','chot'],
  },
  {
    name: 'Surgical Cotton 100g', brand: 'Johnson Cotton', genericName: 'Absorbent Cotton',
    strength: '100g', form: MedicineForm.OTHER, mrp: 55, requiresPrescription: false,
    searchTerms: ['cotton','surgical cotton','wound clean','ruee','absorbent cotton'],
  },
  {
    name: 'Hydrogen Peroxide 100ml', brand: 'H2O2', genericName: 'Hydrogen Peroxide',
    strength: '3%', form: MedicineForm.OTHER, mrp: 35, requiresPrescription: false,
    searchTerms: ['hydrogen peroxide','antiseptic','wound cleaning','ghav saaf'],
  },
  {
    name: 'Surgical Gloves (pair)', brand: 'Ansell', genericName: 'Latex Gloves',
    strength: 'M/L', form: MedicineForm.OTHER, mrp: 25, requiresPrescription: false,
    searchTerms: ['surgical gloves','latex gloves','medical gloves','dressing'],
  },

  // ── DIABETES (PRESCRIPTION) ──────────────────────────────────────────────
  {
    name: 'Metformin 500mg Tablet', brand: 'Glycomet', genericName: 'Metformin',
    strength: '500mg', form: MedicineForm.TABLET, mrp: 35, requiresPrescription: true,
    searchTerms: ['metformin','glycomet','diabetes','blood sugar','sugar ki dawa','type 2 diabetes'],
  },
  {
    name: 'Glimepiride 1mg Tablet', brand: 'Amaryl', genericName: 'Glimepiride',
    strength: '1mg', form: MedicineForm.TABLET, mrp: 55, requiresPrescription: true,
    searchTerms: ['glimepiride','amaryl','diabetes','sugar','blood glucose'],
  },
  {
    name: 'Insulin Glargine 100IU/ml (3ml pen)', brand: 'Lantus', genericName: 'Insulin Glargine',
    strength: '100 IU/ml', form: MedicineForm.INJECTION, mrp: 950, requiresPrescription: true,
    searchTerms: ['lantus','insulin','diabetes insulin','basal insulin','long acting insulin'],
  },
  {
    name: 'Insulin Syringe 1ml (10 pack)', brand: 'BD', genericName: 'Insulin Syringe',
    strength: '1ml / 29G', form: MedicineForm.DEVICE, mrp: 85, requiresPrescription: false,
    searchTerms: ['insulin syringe','syringe','injection','diabetes syringe','bd syringe'],
  },

  // ── HYPERTENSION (PRESCRIPTION) ─────────────────────────────────────────
  {
    name: 'Amlodipine 5mg Tablet', brand: 'Amlovas', genericName: 'Amlodipine',
    strength: '5mg', form: MedicineForm.TABLET, mrp: 45, requiresPrescription: true,
    searchTerms: ['amlodipine','amlovas','blood pressure','hypertension','bp ki dawa','high bp'],
  },
  {
    name: 'Telmisartan 40mg Tablet', brand: 'Telma', genericName: 'Telmisartan',
    strength: '40mg', form: MedicineForm.TABLET, mrp: 75, requiresPrescription: true,
    searchTerms: ['telmisartan','telma','bp','blood pressure','hypertension','high bp'],
  },
  {
    name: 'Atenolol 50mg Tablet', brand: 'Tenormin', genericName: 'Atenolol',
    strength: '50mg', form: MedicineForm.TABLET, mrp: 35, requiresPrescription: true,
    searchTerms: ['atenolol','tenormin','blood pressure','heart rate','hypertension'],
  },

  // ── ANTIBIOTICS (PRESCRIPTION) ───────────────────────────────────────────
  {
    name: 'Amoxicillin 500mg Capsule', brand: 'Mox', genericName: 'Amoxicillin',
    strength: '500mg', form: MedicineForm.CAPSULE, mrp: 85, requiresPrescription: true,
    searchTerms: ['amoxicillin','mox','antibiotic','infection','bacterial infection','throat infection'],
  },
  {
    name: 'Azithromycin 500mg Tablet', brand: 'Azithral', genericName: 'Azithromycin',
    strength: '500mg', form: MedicineForm.TABLET, mrp: 95, requiresPrescription: true,
    searchTerms: ['azithromycin','azithral','zithromax','antibiotic','chest infection','typhoid'],
  },
  {
    name: 'Cefalexin 500mg Capsule', brand: 'Sporidex', genericName: 'Cefalexin',
    strength: '500mg', form: MedicineForm.CAPSULE, mrp: 75, requiresPrescription: true,
    searchTerms: ['cefalexin','sporidex','antibiotic','skin infection','urinary infection','uti'],
  },
  {
    name: 'Ciprofloxacin 500mg Tablet', brand: 'Ciplox', genericName: 'Ciprofloxacin',
    strength: '500mg', form: MedicineForm.TABLET, mrp: 65, requiresPrescription: true,
    searchTerms: ['ciprofloxacin','ciplox','antibiotic','uti','urinary infection','diarrhea infection'],
  },
  {
    name: 'Metronidazole 400mg Tablet', brand: 'Flagyl', genericName: 'Metronidazole',
    strength: '400mg', form: MedicineForm.TABLET, mrp: 30, requiresPrescription: true,
    searchTerms: ['metronidazole','flagyl','amoeba','stomach infection','giardia','loose motion'],
  },

  // ── THYROID (PRESCRIPTION) ───────────────────────────────────────────────
  {
    name: 'Levothyroxine 50mcg Tablet', brand: 'Thyronorm', genericName: 'Levothyroxine',
    strength: '50mcg', form: MedicineForm.TABLET, mrp: 55, requiresPrescription: true,
    searchTerms: ['thyronorm','levothyroxine','thyroid','hypothyroid','thyroid ki dawa'],
  },
  {
    name: 'Levothyroxine 100mcg Tablet', brand: 'Thyronorm', genericName: 'Levothyroxine',
    strength: '100mcg', form: MedicineForm.TABLET, mrp: 75, requiresPrescription: true,
    searchTerms: ['thyronorm 100','levothyroxine 100','thyroid','hypothyroid'],
  },

  // ── CHOLESTEROL (PRESCRIPTION) ───────────────────────────────────────────
  {
    name: 'Atorvastatin 10mg Tablet', brand: 'Atorva', genericName: 'Atorvastatin',
    strength: '10mg', form: MedicineForm.TABLET, mrp: 45, requiresPrescription: true,
    searchTerms: ['atorvastatin','atorva','cholesterol','lipid','statins','heart'],
  },
  {
    name: 'Rosuvastatin 10mg Tablet', brand: 'Rosuvas', genericName: 'Rosuvastatin',
    strength: '10mg', form: MedicineForm.TABLET, mrp: 65, requiresPrescription: true,
    searchTerms: ['rosuvastatin','rosuvas','cholesterol','hdl','ldl','triglycerides'],
  },

  // ── MENTAL HEALTH (PRESCRIPTION) ────────────────────────────────────────
  {
    name: 'Alprazolam 0.25mg Tablet', brand: 'Alprax', genericName: 'Alprazolam',
    strength: '0.25mg', form: MedicineForm.TABLET, mrp: 25, requiresPrescription: true,
    searchTerms: ['alprazolam','alprax','anxiety','panic','sleep','neend'],
  },
  {
    name: 'Clonazepam 0.5mg Tablet', brand: 'Clonotril', genericName: 'Clonazepam',
    strength: '0.5mg', form: MedicineForm.TABLET, mrp: 35, requiresPrescription: true,
    searchTerms: ['clonazepam','clonotril','anxiety','seizure','epilepsy','mitti'],
  },

  // ── WOMEN'S HEALTH ───────────────────────────────────────────────────────
  {
    name: 'Clotrimazole Vaginal Cream 30g', brand: 'Candid V3', genericName: 'Clotrimazole',
    strength: '1%', form: MedicineForm.CREAM, mrp: 95, requiresPrescription: false,
    searchTerms: ['candid v','clotrimazole vaginal','yeast infection','fungal','vaginal itching'],
  },
  {
    name: 'Folic Acid 5mg Tablet', brand: 'Folvite', genericName: 'Folic Acid',
    strength: '5mg', form: MedicineForm.TABLET, mrp: 30, requiresPrescription: false,
    searchTerms: ['folvite','folic acid','pregnancy','neural tube','anaemia','garbhavastha'],
  },
  {
    name: 'Pregnancy Test Kit', brand: 'Pregacolor', genericName: 'Pregnancy Test Kit',
    strength: 'N/A', form: MedicineForm.DEVICE, mrp: 55, requiresPrescription: false,
    searchTerms: ['pregnancy test','pregacolor','pregnancy kit','garbh pareeksha','i card'],
  },

  // ── CHILD HEALTH ─────────────────────────────────────────────────────────
  {
    name: 'Paediatric Electrolyte Sachet', brand: 'Pedialyte', genericName: 'ORS Paediatric',
    strength: 'Standard', form: MedicineForm.POWDER, mrp: 25, requiresPrescription: false,
    searchTerms: ['pedialyte','child ors','baby dehydration','bachche ka ors','diarrhea child'],
  },
  {
    name: 'Vitamin D3 Drops 15ml', brand: 'Arachitol', genericName: 'Cholecalciferol Drops',
    strength: '400 IU/0.5ml', form: MedicineForm.DROPS, mrp: 85, requiresPrescription: false,
    searchTerms: ['arachitol drops','vitamin d drops','baby vitamin d','infant vitamin d','bachche ka d3'],
  },
  {
    name: 'Zinc Syrup 60ml', brand: 'Zinconia', genericName: 'Zinc Sulphate Syrup',
    strength: '20mg/5ml', form: MedicineForm.SYRUP, mrp: 65, requiresPrescription: false,
    searchTerms: ['zinconia','zinc syrup','child diarrhea','loose motion child','immunity child'],
  },
  {
    name: 'Ibuprofen 100mg/5ml Syrup 60ml', brand: 'Ibugesic', genericName: 'Ibuprofen',
    strength: '100mg/5ml', form: MedicineForm.SYRUP, mrp: 55, requiresPrescription: false,
    searchTerms: ['ibugesic','ibuprofen syrup','child fever','teething pain','bachche ka bukhar'],
  },

  // ── SLEEP & ANXIETY (OTC) ────────────────────────────────────────────────
  {
    name: 'Melatonin 5mg Tablet', brand: 'Meloset', genericName: 'Melatonin',
    strength: '5mg', form: MedicineForm.TABLET, mrp: 85, requiresPrescription: false,
    searchTerms: ['meloset','melatonin','sleep','insomnia','neend nahi','jet lag'],
  },
  {
    name: 'Ashwagandha 300mg Capsule', brand: 'Himalaya Ashvagandha', genericName: 'Withania Somnifera',
    strength: '300mg', form: MedicineForm.CAPSULE, mrp: 155, requiresPrescription: false,
    searchTerms: ['ashwagandha','ashvagandha','stress','anxiety','energy','immunity','ayurvedic'],
  },
  {
    name: 'Triphala Churna 100g', brand: 'Dabur Triphala', genericName: 'Triphala',
    strength: 'Standard', form: MedicineForm.POWDER, mrp: 65, requiresPrescription: false,
    searchTerms: ['triphala','triphala churna','constipation','digestion','ayurvedic','kabz'],
  },

  // ── ORAL HEALTH ──────────────────────────────────────────────────────────
  {
    name: 'Chlorhexidine Mouthwash 100ml', brand: 'Hexidine', genericName: 'Chlorhexidine',
    strength: '0.2%', form: MedicineForm.OTHER, mrp: 75, requiresPrescription: false,
    searchTerms: ['hexidine','chlorhexidine','mouthwash','mouth ulcer','gum infection','oral hygiene'],
  },
  {
    name: 'Benzocaine Gel 10g', brand: 'Mucopain', genericName: 'Benzocaine',
    strength: '20%', form: MedicineForm.CREAM, mrp: 55, requiresPrescription: false,
    searchTerms: ['mucopain','benzocaine','toothache','mouth ulcer','dant dard','oral gel'],
  },

  // ── MISCELLANEOUS OTC ────────────────────────────────────────────────────
  {
    name: 'Glucose-D Orange 500g', brand: 'Glucon-D', genericName: 'Dextrose',
    strength: 'Standard', form: MedicineForm.POWDER, mrp: 95, requiresPrescription: false,
    searchTerms: ['glucon d','glucose powder','energy drink','dehydration','instant energy'],
  },
  {
    name: 'Hand Sanitiser 100ml', brand: 'Dettol Sanitiser', genericName: 'Isopropyl Alcohol',
    strength: '70%', form: MedicineForm.OTHER, mrp: 65, requiresPrescription: false,
    searchTerms: ['sanitiser','hand sanitizer','dettol','alcohol sanitizer','germ kill'],
  },
  {
    name: 'Antiseptic Liquid 100ml', brand: 'Dettol', genericName: 'Chloroxylenol',
    strength: '4.8%', form: MedicineForm.OTHER, mrp: 75, requiresPrescription: false,
    searchTerms: ['dettol','antiseptic','wound clean','bath antiseptic','keetatanu'],
  },
  {
    name: 'Mask Surgical (pack of 10)', brand: 'Surgical Mask', genericName: 'Face Mask',
    strength: 'N/A', form: MedicineForm.OTHER, mrp: 45, requiresPrescription: false,
    searchTerms: ['mask','surgical mask','face mask','3 ply mask','protection'],
  },
];
