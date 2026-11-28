// ============================================================
// PedaClic — Phase 61 : interrupteur des requêtes de quiz « scindées »
// ------------------------------------------------------------
//   false → ÉTAPE 1 : requêtes historiques (comportement inchangé).
//   true  → ÉTAPE 2 : requêtes compatibles avec les règles durcies
//                     (quiz globaux where('groupeId','==',null) + une
//                     requête par groupe / par cahier).
//
// ⚠️ Ne passer à true qu'APRÈS avoir lancé la migration Phase 61
//    (tableau de bord admin → Maintenance) : sinon les anciens quiz sans
//    champ groupeId / status disparaîtraient des listes.
// ⚠️ Une fois l'étape 3 (règles de lecture) déployée, NE PLUS repasser à
//    false : les anciennes requêtes seraient refusées par Firestore.
// Retour arrière de l'étape 2 = remettre false et redéployer le site.
// ============================================================

export const PHASE61_REQUETES_SCINDEES = false;
