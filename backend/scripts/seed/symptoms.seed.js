import SymptomDictionary from "../../src/modules/search/symptom_dictionary.model.js";

export const comprehensiveSymptomList = [
  // --- General Medicine / General Physician ---
  {
    name: "fever",
    aliases: ["high temperature", "pyrexia", "warm body", "febrile", "typhoid", "dengue", "malaria", "viral fever", "chills"],
    specializationIds: ["General Medicine", "General Physician"],
    severity: "medium",
    tags: ["general", "fever", "infection"]
  },
  {
    name: "cold",
    aliases: ["common cold", "cough and cold", "influenza", "flu", "stuffy nose", "sneezing", "head cold"],
    specializationIds: ["General Medicine", "General Physician", "ENT"],
    severity: "low",
    tags: ["general", "cold"]
  },
  {
    name: "cough",
    aliases: ["dry cough", "wet cough", "coughing", "throat cough", "phlegm"],
    specializationIds: ["General Medicine", "General Physician", "ENT"],
    severity: "low",
    tags: ["general", "respiratory"]
  },
  {
    name: "fatigue",
    aliases: ["weakness", "lethargy", "tiredness", "exhaustion", "low energy", "feeling weak"],
    specializationIds: ["General Medicine", "General Physician"],
    severity: "low",
    tags: ["general"]
  },
  {
    name: "body ache",
    aliases: ["myalgia", "body pain", "muscle soreness", "generalized pain", "body aches"],
    specializationIds: ["General Medicine", "General Physician"],
    severity: "low",
    tags: ["general", "pain"]
  },
  {
    name: "infection",
    aliases: ["bacterial infection", "viral infection", "fever infection", "systemic infection"],
    specializationIds: ["General Medicine", "General Physician"],
    severity: "medium",
    tags: ["general", "infection"]
  },
  {
    name: "hypertension",
    aliases: ["high blood pressure", "high bp", "bp problem", "blood pressure"],
    specializationIds: ["General Medicine", "General Physician", "Cardiology"],
    severity: "medium",
    tags: ["general", "cardiology"]
  },
  {
    name: "anemia",
    aliases: ["low hemoglobin", "low iron", "pale skin", "iron deficiency"],
    specializationIds: ["General Medicine", "General Physician"],
    severity: "low",
    tags: ["general"]
  },

  // --- Cardiology ---
  {
    name: "chest pain",
    aliases: ["angina", "heart pain", "cardiac pressure", "chest heaviness", "chest discomfort", "chest tightness"],
    specializationIds: ["Cardiology", "General Medicine"],
    severity: "high",
    tags: ["cardiology", "emergency"]
  },
  {
    name: "palpitations",
    aliases: ["racing heart", "irregular heartbeat", "heart fluttering", "fast heart rate", "tachycardia"],
    specializationIds: ["Cardiology"],
    severity: "medium",
    tags: ["cardiology"]
  },
  {
    name: "shortness of breath",
    aliases: ["dyspnea", "breathing difficulty", "breathlessness", "heavy breathing"],
    specializationIds: ["Cardiology", "General Medicine"],
    severity: "high",
    tags: ["cardiology", "emergency"]
  },
  {
    name: "heart attack",
    aliases: ["myocardial infarction", "cardiac arrest", "severe chest pain"],
    specializationIds: ["Cardiology"],
    severity: "high",
    tags: ["cardiology", "emergency"]
  },

  // --- Neurology ---
  {
    name: "headache",
    aliases: ["migraine", "head pain", "head aches", "migraine headache", "throbbing head pain", "cluster headache"],
    specializationIds: ["Neurology", "General Medicine"],
    severity: "low",
    tags: ["pain", "neurology"]
  },
  {
    name: "seizures",
    aliases: ["convulsions", "fits", "seizure episode", "epilepsy"],
    specializationIds: ["Neurology"],
    severity: "high",
    tags: ["neurology", "emergency"]
  },
  {
    name: "dizziness",
    aliases: ["vertigo", "giddiness", "lightheadedness", "unsteadiness", "spinning head"],
    specializationIds: ["Neurology", "General Medicine"],
    severity: "medium",
    tags: ["neurology"]
  },
  {
    name: "numbness",
    aliases: ["tingling sensation", "loss of sensation", "neuropathy", "nerve pain", "pins and needles"],
    specializationIds: ["Neurology"],
    severity: "medium",
    tags: ["neurology"]
  },
  {
    name: "stroke",
    aliases: ["paralysis", "facial palsy", "brain stroke", "slurred speech"],
    specializationIds: ["Neurology"],
    severity: "high",
    tags: ["neurology", "emergency"]
  },
  {
    name: "memory loss",
    aliases: ["dementia", "forgetfulness", "alzheimers", "cognitive decline"],
    specializationIds: ["Neurology", "Psychiatry"],
    severity: "medium",
    tags: ["neurology"]
  },

  // --- Orthopedics ---
  {
    name: "fracture",
    aliases: ["broken bone", "bone crack", "fractured wrist", "fractured leg", "bone injury", "fractured arm"],
    specializationIds: ["Orthopedics"],
    severity: "high",
    tags: ["orthopedics", "injury"]
  },
  {
    name: "joint pain",
    aliases: ["knee pain", "shoulder pain", "elbow pain", "arthritis pain", "joint stiffness", "rheumatoid"],
    specializationIds: ["Orthopedics", "General Medicine"],
    severity: "medium",
    tags: ["orthopedics"]
  },
  {
    name: "back pain",
    aliases: ["backache", "spinal pain", "lumbar ache", "lower back pain", "spondylitis", "sciatica"],
    specializationIds: ["Orthopedics", "General Medicine"],
    severity: "low",
    tags: ["orthopedics"]
  },
  {
    name: "sprain",
    aliases: ["ligament tear", "ankle sprain", "muscle sprain", "swollen joint"],
    specializationIds: ["Orthopedics"],
    severity: "medium",
    tags: ["orthopedics"]
  },

  // --- ENT (Ear, Nose, Throat) ---
  {
    name: "earache",
    aliases: ["ear pain", "ear blockage", "otitis", "ear infection", "hearing problem", "tinnitus"],
    specializationIds: ["ENT"],
    severity: "low",
    tags: ["ent"]
  },
  {
    name: "sore throat",
    aliases: ["throat pain", "pain swallowing", "throat infection", "tonsillitis", "pharyngitis"],
    specializationIds: ["ENT", "General Medicine"],
    severity: "low",
    tags: ["ent"]
  },
  {
    name: "sinus",
    aliases: ["sinusitis", "sinus pain", "nasal blockage", "sinus headache"],
    specializationIds: ["ENT"],
    severity: "low",
    tags: ["ent"]
  },
  {
    name: "runny nose",
    aliases: ["cold nose", "nasal congestion", "blocked nose", "rhinitis", "allergic rhinitis"],
    specializationIds: ["ENT", "General Medicine"],
    severity: "low",
    tags: ["ent", "cold"]
  },

  // --- Dermatology ---
  {
    name: "rash",
    aliases: ["skin rash", "hives", "eczema", "red spots", "psoriasis", "skin allergy", "dermatitis"],
    specializationIds: ["Dermatology"],
    severity: "low",
    tags: ["dermatology"]
  },
  {
    name: "skin itching",
    aliases: ["pruritus", "itchy skin", "scabies", "fungal infection", "ringworm"],
    specializationIds: ["Dermatology"],
    severity: "low",
    tags: ["dermatology"]
  },
  {
    name: "acne",
    aliases: ["pimples", "blackheads", "skin breakouts", "facial acne", "zits"],
    specializationIds: ["Dermatology"],
    severity: "low",
    tags: ["dermatology"]
  },
  {
    name: "hair loss",
    aliases: ["alopecia", "hair fall", "dandruff", "baldness", "scalp infection"],
    specializationIds: ["Dermatology"],
    severity: "low",
    tags: ["dermatology"]
  },

  // --- Pediatrics ---
  {
    name: "child fever",
    aliases: ["pediatric temperature", "baby fever", "child warmness", "infant fever"],
    specializationIds: ["Pediatrics", "General Medicine"],
    severity: "medium",
    tags: ["pediatrics", "fever"]
  },
  {
    name: "baby colic",
    aliases: ["infant crying", "colic pain", "baby gas", "child stomachache"],
    specializationIds: ["Pediatrics"],
    severity: "low",
    tags: ["pediatrics"]
  },
  {
    name: "child cold",
    aliases: ["pediatric cough", "child cough", "baby cold", "child flu"],
    specializationIds: ["Pediatrics", "General Medicine"],
    severity: "low",
    tags: ["pediatrics"]
  },

  // --- Gastroenterology / Stomach ---
  {
    name: "stomach pain",
    aliases: ["abdominal pain", "stomach ache", "belly pain", "gastric pain", "gut pain", "stomach cramps"],
    specializationIds: ["Gastroenterology", "General Medicine"],
    severity: "medium",
    tags: ["gastroenterology"]
  },
  {
    name: "acidity",
    aliases: ["acid reflux", "heartburn", "GERD", "gastritis", "gas problem", "indigestion"],
    specializationIds: ["Gastroenterology", "General Medicine"],
    severity: "low",
    tags: ["gastroenterology"]
  },
  {
    name: "diarrhea",
    aliases: ["loose motions", "stomach upset", "dysentery", "food poisoning", "loose stools"],
    specializationIds: ["Gastroenterology", "General Medicine"],
    severity: "medium",
    tags: ["gastroenterology"]
  },
  {
    name: "constipation",
    aliases: ["hard stool", "bowel problem", "irregular bowel", "piles"],
    specializationIds: ["Gastroenterology", "General Medicine"],
    severity: "low",
    tags: ["gastroenterology"]
  },
  {
    name: "vomiting",
    aliases: ["nausea", "throwing up", "emesis", "stomach bug"],
    specializationIds: ["Gastroenterology", "General Medicine"],
    severity: "medium",
    tags: ["gastroenterology"]
  },
  {
    name: "jaundice",
    aliases: ["yellow eyes", "liver problem", "hepatitis", "yellow skin"],
    specializationIds: ["Gastroenterology", "General Medicine"],
    severity: "high",
    tags: ["gastroenterology"]
  },

  // --- Pulmonology ---
  {
    name: "asthma",
    aliases: ["wheezing", "bronchial asthma", "asthma attack", "airway constriction"],
    specializationIds: ["Pulmonology", "General Medicine"],
    severity: "high",
    tags: ["pulmonology"]
  },
  {
    name: "pneumonia",
    aliases: ["lung infection", "chest infection", "bronchitis", "tuberculosis", "tb"],
    specializationIds: ["Pulmonology", "General Medicine"],
    severity: "high",
    tags: ["pulmonology"]
  },

  // --- Gynecology ---
  {
    name: "pregnancy",
    aliases: ["pregnant", "maternity", "prenatal", "morning sickness", "obstetrics"],
    specializationIds: ["Gynecology", "General Medicine"],
    severity: "medium",
    tags: ["gynecology"]
  },
  {
    name: "period pain",
    aliases: ["menstrual cramps", "dysmenorrhea", "irregular periods", "PCOD", "PCOS", "heavy bleeding"],
    specializationIds: ["Gynecology"],
    severity: "medium",
    tags: ["gynecology"]
  },

  // --- Ophthalmology ---
  {
    name: "eye pain",
    aliases: ["blurred vision", "cataract", "red eye", "conjunctivitis", "eye infection", "dry eye"],
    specializationIds: ["Ophthalmology"],
    severity: "medium",
    tags: ["ophthalmology"]
  },

  // --- Urology ---
  {
    name: "urine problem",
    aliases: ["burning urination", "dysuria", "UTI", "urinary tract infection", "kidney stone", "frequent urination"],
    specializationIds: ["Urology", "General Medicine"],
    severity: "medium",
    tags: ["urology"]
  },

  // --- Psychiatry ---
  {
    name: "anxiety",
    aliases: ["depression", "stress", "panic attack", "insomnia", "sleep disorder", "mental stress"],
    specializationIds: ["Psychiatry"],
    severity: "medium",
    tags: ["psychiatry"]
  },

  // --- Endocrinology ---
  {
    name: "thyroid",
    aliases: ["hypothyroidism", "hyperthyroidism", "goiter", "thyroid problem"],
    specializationIds: ["Endocrinology", "General Medicine"],
    severity: "medium",
    tags: ["endocrinology"]
  },
  {
    name: "diabetes",
    aliases: ["high sugar", "diabetic", "blood sugar", "hyperglycemia"],
    specializationIds: ["Endocrinology", "General Medicine"],
    severity: "medium",
    tags: ["endocrinology"]
  }
];

export const seedSymptoms = async (hashedPassword, context) => {
  console.log("Seeding Comprehensive Multi-Specialty Symptom Dictionary...");

  await SymptomDictionary.deleteMany({});
  const created = await SymptomDictionary.insertMany(comprehensiveSymptomList);
  console.log(`  - Seeded ${created.length} symptom & disease dictionary entries across all medical departments.`);
  if (context) {
    context.seededSymptoms = created;
  }
};
