export interface LibraryQuestion {
  key: string;
  label: string;
  kind: "YES_NO" | "TEXT";
  detailRequiredWhenYes: boolean;
  alertWhenYes: boolean;
  sensitive: boolean;
  defaultActive: boolean;
  order: number;
}

export const QUESTION_LIBRARY: LibraryQuestion[] = [
  { key: "hypertension",           label: "Hipertensão arterial?",                               kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 1  },
  { key: "diabetes",               label: "Diabetes?",                                           kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 2  },
  { key: "heartDisease",           label: "Cardiopatia / doença cardíaca?",                      kind: "YES_NO", detailRequiredWhenYes: true,  alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 3  },
  { key: "heartPacemaker",         label: "Portador(a) de marca-passo?",                         kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 4  },
  { key: "anticoagulant",          label: "Uso de anticoagulante (AAS, Warfarina, etc.)?",       kind: "YES_NO", detailRequiredWhenYes: true,  alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 5  },
  { key: "bleedingProblems",       label: "Problemas de sangramento ou coagulação?",             kind: "YES_NO", detailRequiredWhenYes: true,  alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 6  },
  { key: "bisphosphonate",         label: "Uso de bisfosfonato (Alendronato, Zoledronato, etc.)?", kind: "YES_NO", detailRequiredWhenYes: true, alertWhenYes: true, sensitive: false, defaultActive: true,  order: 7  },
  { key: "allergyAnesthetic",      label: "Alergia a anestésico local?",                         kind: "YES_NO", detailRequiredWhenYes: true,  alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 8  },
  { key: "allergyPenicillin",      label: "Alergia a penicilina / antibiótico?",                 kind: "YES_NO", detailRequiredWhenYes: true,  alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 9  },
  { key: "allergyLatex",           label: "Alergia a látex?",                                    kind: "YES_NO", detailRequiredWhenYes: true,  alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 10 },
  { key: "allergyAspirin",         label: "Alergia a AAS/aspirina?",                             kind: "YES_NO", detailRequiredWhenYes: true,  alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 11 },
  { key: "allergyIodine",          label: "Alergia a iodo / contraste?",                         kind: "YES_NO", detailRequiredWhenYes: true,  alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 12 },
  { key: "asthma",                 label: "Asma / problemas respiratórios?",                     kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 13 },
  { key: "sleepApnea",             label: "Apneia do sono?",                                     kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 14 },
  { key: "epilepsy",               label: "Epilepsia / convulsões?",                             kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 15 },
  { key: "kidneyLiverDisease",     label: "Doença renal ou hepática?",                           kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 16 },
  { key: "dialysis",               label: "Em diálise?",                                         kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 17 },
  { key: "thyroidDisease",         label: "Doença da tireoide?",                                 kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 18 },
  { key: "osteoporosis",           label: "Osteoporose?",                                        kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 19 },
  { key: "arthritisRheumatism",    label: "Artrite / reumatismo?",                               kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 20 },
  { key: "neurologicalDisorder",   label: "Distúrbio neurológico?",                              kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 21 },
  { key: "immunosuppressant",      label: "Uso de imunossupressor?",                             kind: "YES_NO", detailRequiredWhenYes: true,  alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 22 },
  { key: "corticosteroid",         label: "Uso de corticosteroide?",                             kind: "YES_NO", detailRequiredWhenYes: true,  alertWhenYes: false, sensitive: false, defaultActive: true,  order: 23 },
  { key: "chemotherapy",           label: "Em quimioterapia ou radioterapia?",                   kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 24 },
  { key: "transplant",             label: "Transplantado(a)?",                                   kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 25 },
  { key: "prosthesisImplant",      label: "Prótese ou implante (valva, articulação)?",           kind: "YES_NO", detailRequiredWhenYes: true,  alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 26 },
  { key: "anemia",                 label: "Anemia?",                                             kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 27 },
  { key: "sickleCellDisease",      label: "Doença falciforme?",                                  kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 28 },
  { key: "gastricProblems",        label: "Problemas gástricos (gastrite, úlcera)?",             kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 29 },
  { key: "oralContraceptive",      label: "Uso de anticoncepcional oral?",                       kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 30 },
  { key: "hormonalTherapy",        label: "Terapia hormonal?",                                   kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 31 },
  { key: "pregnantOrBreastfeeding", label: "Gestante ou lactante?",                              kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: true,  sensitive: false, defaultActive: true,  order: 32 },
  { key: "anxietyDepression",      label: "Ansiedade / depressão em tratamento?",                kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 33 },
  { key: "smoker",                 label: "Fumante?",                                            kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 34 },
  { key: "alcoholism",             label: "Uso frequente de álcool?",                            kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 35 },
  { key: "previousSurgeries",      label: "Cirurgias anteriores?",                               kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 36 },
  { key: "underMedicalTreatment",  label: "Em tratamento médico contínuo?",                     kind: "YES_NO", detailRequiredWhenYes: true,  alertWhenYes: false, sensitive: false, defaultActive: true,  order: 37 },
  { key: "covid19Sequelae",        label: "Sequelas de Covid-19?",                               kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 38 },
  { key: "otherConditions",        label: "Outras condições de saúde relevantes?",               kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: false, sensitive: false, defaultActive: true,  order: 39 },
  // Sensíveis — criados com active=false
  { key: "hiv",                    label: "HIV/AIDS positivo?",                                  kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: true,  sensitive: true,  defaultActive: false, order: 40 },
  { key: "hepatitisB",             label: "Hepatite B?",                                         kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: true,  sensitive: true,  defaultActive: false, order: 41 },
  { key: "hepatitisC",             label: "Hepatite C?",                                         kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: true,  sensitive: true,  defaultActive: false, order: 42 },
  { key: "std",                    label: "DST / IST?",                                          kind: "YES_NO", detailRequiredWhenYes: false, alertWhenYes: true,  sensitive: true,  defaultActive: false, order: 43 },
];
